import { Server as IoServer, Socket } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { verifyJwt, JwtPayload } from '../utils/jwt';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { Session, SessionDoc } from '../models/Session';
import { SessionParticipant } from '../models/SessionParticipant';
import { Admin } from '../models/Admin';
import { User } from '../models/User';
import { SOCKET_EVENTS, NowPlayingDTO, QueueItemDTO, ActivityEventDTO } from '@tuneslam/shared';
import { getOrderedQueue, serializeItem, serializeQueue } from './queue';
import { nowPlayingDTO } from './serializers';
import { actorFromUser, buildActivityEvent } from './activity';



let io: IoServer | null = null;

/**
 * Per-(slug,userId) cooldown for `userJoined` ticker events. Without it
 * a flaky network or React StrictMode double-mount would spam the
 * ticker with the same join. 60 s feels short enough that a real
 * re-join (after stepping away) still surfaces, while a reconnect
 * blip is suppressed.
 */
const RECENT_JOIN_TTL_MS = 60_000;
const recentJoins = new Map<string, number>();
function shouldEmitJoin(slug: string, userId: string): boolean {
  const key = `${slug}:${userId}`;
  const now = Date.now();
  const last = recentJoins.get(key);
  if (last && now - last < RECENT_JOIN_TTL_MS) return false;
  recentJoins.set(key, now);
  // Lazy GC: when the map grows past 5k entries, drop everything older
  // than the TTL. Cheap, and the population stays bounded by active
  // session count.
  if (recentJoins.size > 5000) {
    for (const [k, t] of recentJoins) {
      if (now - t > RECENT_JOIN_TTL_MS) recentJoins.delete(k);
    }
  }
  return true;
}


interface AuthedSocket extends Socket {
  data: {
    auth?: JwtPayload;
    session?: string;
  };
}

export function getIo(): IoServer {
  if (!io) throw new Error('Socket.io not initialised');
  return io;
}

export function initRealtime(httpServer: HttpServer): IoServer {
  io = new IoServer(httpServer, {
    cors: { origin: env.CORS_ORIGINS, credentials: true },
  });

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth as any)?.token ||
      (socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '');
    if (!token) return next(new Error('No token'));
    try {
      const payload = verifyJwt(token);
      (socket as AuthedSocket).data.auth = payload;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const s = socket as AuthedSocket;
    logger.debug({ id: s.id, aud: s.data.auth?.aud }, 'socket connected');

    s.on(SOCKET_EVENTS.joinSession, async (slug: string) => {
      if (typeof slug !== 'string' || !slug) return;
      const session = await Session.findOne({ slug });
      if (!session) return;
      // Track participant for users.
      if (s.data.auth?.aud === 'usr') {
        await SessionParticipant.updateOne(
          { sessionId: session._id, userId: s.data.auth.sub },
          { $set: { lastSeenAt: new Date() }, $setOnInsert: { joinedAt: new Date() } },
          { upsert: true },
        );
      }
      s.data.session = slug;
      s.join(roomFor(slug));

      // Hand the joining socket an immediate snapshot so the UI doesn't have
      // to wait for the next mutation to populate. Without this, a client
      // that joins after songs are queued would see an empty queue until
      // someone votes/adds.
      //
      // The snapshot is *personalized* (myVote populated) so the user's
      // own up/down arrows render in their pressed state on (re)join —
      // a refresh otherwise resets every button to the unpressed state.
      try {
        const ordered = await getOrderedQueue(session);
        const voter = voterFromSocket(s);
        // Pass the session through so `serializeItem` can mask
        // downvotes when the admin selected `noEffectOnOrder`.
        const downvoteBehavior = session.settings.downvoteBehavior ?? 'standard';
        const items = ordered.map((it) =>
          serializeItem(it, { voter, downvoteBehavior }),
        );
        s.emit(SOCKET_EVENTS.queueUpdate, { items });
        s.emit(SOCKET_EVENTS.nowPlayingUpdate, nowPlayingDTO(session));
      } catch (err) {

        logger.warn({ err }, 'failed to send initial session snapshot');
      }

      // Emit a `userJoined` ticker event the first time *this user*
      // joins the session in a 60 s window. We fetch the user doc only
      // when we actually intend to emit so we don't add a Mongo round
      // trip to every reconnect.
      if (s.data.auth?.aud === 'usr' && s.data.auth.sub) {
        if (shouldEmitJoin(slug, s.data.auth.sub)) {
          try {
            const user = await User.findById(s.data.auth.sub);
            if (user) {
              broadcastActivity(slug, buildActivityEvent('userJoined', actorFromUser(user)));
            }
          } catch (err) {
            logger.warn({ err }, 'failed to emit userJoined ticker event');
          }
        }
      }

    });


    s.on(SOCKET_EVENTS.leaveSession, (slug: string) => {
      if (typeof slug === 'string') s.leave(roomFor(slug));
    });

    s.on('disconnect', () => {
      logger.debug({ id: s.id }, 'socket disconnected');
    });
  });

  return io;
}

export function roomFor(slug: string): string {
  return `session:${slug}`;
}

/**
 * Map an authed socket to a `voter` shape suitable for `serializeItem`.
 * Returns null for sockets without a recognised audience (e.g. player tabs)
 * so they get an anonymous snapshot.
 */
function voterFromSocket(
  s: AuthedSocket,
): { kind: 'admin' | 'user'; id: string } | null {
  const aud = s.data.auth?.aud;
  const sub = s.data.auth?.sub;
  if (!sub) return null;
  if (aud === 'adm') return { kind: 'admin', id: sub };
  if (aud === 'usr') return { kind: 'user', id: sub };
  return null;
}

export async function broadcastQueue(session: SessionDoc): Promise<void> {
  if (!io) return;
  const roomName = roomFor(session.slug);
  const sids = io.sockets.adapter.rooms.get(roomName);
  if (!sids?.size) return;

  // Personalize per-socket so each user/admin sees `myVote` populated for
  // their own votes. Otherwise the anonymous snapshot would clear every
  // up/down arrow's "pressed" state on every queue mutation. We do a
  // single DB read and re-serialize per socket from the in-memory docs.
  const ordered = await getOrderedQueue(session);
  // Pull the per-session downvote behavior once and thread it into
  // every serialize call so clients see the right `netVotes`/
  // `downvotes` (masked to upvotes-only when `noEffectOnOrder`).
  const downvoteBehavior = session.settings.downvoteBehavior ?? 'standard';
  let anonItems: QueueItemDTO[] | null = null;

  for (const sid of sids) {
    const sock = io.sockets.sockets.get(sid) as AuthedSocket | undefined;
    if (!sock) continue;
    const voter = voterFromSocket(sock);
    if (voter) {
      sock.emit(SOCKET_EVENTS.queueUpdate, {
        items: ordered.map((it) => serializeItem(it, { voter, downvoteBehavior })),
      });
    } else {
      if (!anonItems) {
        anonItems = ordered.map((it) => serializeItem(it, { downvoteBehavior }));
      }
      sock.emit(SOCKET_EVENTS.queueUpdate, { items: anonItems });
    }
  }

}


export function broadcastNowPlaying(session: SessionDoc, dto: NowPlayingDTO): void {
  if (!io) return;
  io.to(roomFor(session.slug)).emit(SOCKET_EVENTS.nowPlayingUpdate, dto);
}

export function broadcastSessionActive(session: SessionDoc): void {
  if (!io) return;
  io.to(roomFor(session.slug)).emit(SOCKET_EVENTS.sessionActive, { active: session.active });
}

export function broadcastUserBlocked(slug: string, userId: string, blocked: boolean): void {
  if (!io) return;
  io.to(roomFor(slug)).emit(SOCKET_EVENTS.userBlocked, { userId, blocked });
}

export function broadcastPlayerCommand(
  slug: string,
  command: 'play' | 'pause' | 'skip' | 'transfer',
  payload: any = {},
): void {
  if (!io) return;
  io.to(roomFor(slug)).emit(SOCKET_EVENTS.playerCommand, { command, ...payload });
}

export function broadcastPlayerClaim(slug: string, info: { adminId: string; ts: number }): void {
  if (!io) return;
  io.to(roomFor(slug)).emit(SOCKET_EVENTS.playerClaim, info);
}

export function broadcastAutofillAdded(slug: string, count: number): void {
  if (!io) return;
  io.to(roomFor(slug)).emit(SOCKET_EVENTS.autofillAdded, { count });
}

/**
 * Push a single activity ticker event to every socket in the session
 * room. The player tab's <ActivityTicker> is the primary consumer;
 * other UIs are free to ignore the event. Routes wanting to add a new
 * ticker entry should call this — see services/activity.ts for the
 * actor/event constructors.
 */
export function broadcastActivity(slug: string, event: ActivityEventDTO): void {
  if (!io) return;
  io.to(roomFor(slug)).emit(SOCKET_EVENTS.activityEvent, event);
}

