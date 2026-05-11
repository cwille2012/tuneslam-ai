import { Server as IoServer, Socket } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { verifyJwt, JwtPayload } from '../utils/jwt';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { Session, SessionDoc } from '../models/Session';
import { SessionParticipant } from '../models/SessionParticipant';
import { Admin } from '../models/Admin';
import { User } from '../models/User';
import { SOCKET_EVENTS, NowPlayingDTO, QueueItemDTO } from '@tuneslam/shared';
import { serializeQueue } from './queue';
import { nowPlayingDTO } from './serializers';

let io: IoServer | null = null;

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
      try {
        const items = await serializeQueue(session._id);
        s.emit(SOCKET_EVENTS.queueUpdate, { items });
        s.emit(SOCKET_EVENTS.nowPlayingUpdate, nowPlayingDTO(session));
      } catch (err) {
        logger.warn({ err }, 'failed to send initial session snapshot');
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

export async function broadcastQueue(session: SessionDoc): Promise<void> {
  if (!io) return;
  // Anonymous queue snapshot (no per-voter myVote). Each client requests
  // their own queue via REST when they need myVote populated.
  const items = await serializeQueue(session._id);
  io.to(roomFor(session.slug)).emit(SOCKET_EVENTS.queueUpdate, { items });
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
