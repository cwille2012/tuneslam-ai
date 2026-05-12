import { useEffect, useRef, useState } from 'react';
import { SOCKET_EVENTS, ActivityEventDTO } from '@tuneslam/shared';

/**
 * Footer ticker that scrolls activity events across the bottom of the
 * player. Each event is its own absolutely-positioned element running
 * a one-shot CSS animation from off-right to off-left, then unmounting
 * itself via `onAnimationEnd`. A small scheduler ensures a constant
 * px/sec inter-item gap so back-to-back events queue up neatly instead
 * of stacking on top of each other.
 *
 * **Why per-item, not a marquee track**
 * The first cut rendered every event twice in the DOM and scrolled the
 * whole strip with `translateX(0) → translateX(-50%)` for seamless
 * looping. That literally meant the same event was visible twice at
 * once — exactly the duplication the user reported. Per-item lanes
 * sidestep the problem entirely: a vote emits one DOM node, scrolls
 * once, unmounts.
 *
 * **Idle filler**
 * When there have been no real events for `IDLE_QUIET_MS`, we enqueue
 * the next house message (round-robin from `IDLE_MESSAGES`) so the
 * strip stays alive. Real events reset the quiet timer naturally
 * because they go through the same `enqueue()` path.
 *
 * **Adding a new event kind** is two edits: add it to `ActivityKind`
 * in `shared/src/types.ts` and add a label here in `describe()`.
 * Server-side calls `broadcastActivity()` from
 * `backend/src/services/realtime.ts`.
 */

/** Marquee speed, in CSS pixels per second. Slow enough to read each
 *  item comfortably from across a room. */
const PX_PER_SEC = 50;
/** Approximate widest-case item width in px (avatar + text). Used to
 *  compute total animation distance so even a long track title fully
 *  exits the right edge before disappearing. */
const VIEWPORT_OVERSHOOT_PX = 600;
/** Minimum start-to-start spacing between two consecutive items, in px.
 *  Must be larger than any plausible item width so consecutive items
 *  can never physically overlap on screen — that overlap was the
 *  "blob" the user reported. At PX_PER_SEC=50 this works out to a
 *  14 s in-time gap between item starts. */
const ITEM_PITCH_PX = 700;
/** How long the strip must be quiet before we enqueue an idle message.
 *  Real events still reset the timer because they go through the same
 *  `enqueue()` path, so a busy room never sees a house message. */
const IDLE_QUIET_MS = 30_000;


/** House messages shown when no real activity is happening. Add lines
 *  here to expand the rotation; selection is round-robin so they don't
 *  repeat back-to-back. */
const IDLE_MESSAGES: string[] = [
  'Scan the QR code to join now!',
  'Join to add your music!',
  'Thousands of songs at your fingertips!',
  'Not what you like? Vote now!',
  'Your queue, your party — jump in!',
  'Hear something good? Upvote it!',
];

/**
 * Idle item — a purely client-side ticker entry that doesn't carry an
 * actor. Renders with a sparkle glyph instead of an avatar.
 */
interface IdleEvent {
  id: string;
  kind: 'idle';
  ts: number;
  message: string;
}

type AnyEvent = ActivityEventDTO | IdleEvent;

interface Lane {
  ev: AnyEvent;
  /** Delay before the slide animation starts, in ms (relative to
   *  mount time so the per-item CSS variable can use it directly). */
  delayMs: number;
  /** Total animation duration, in ms. Computed from window width so
   *  the keyframe end-state always exits the viewport. */
  durationMs: number;
}

function makeId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function ActivityTicker({ socket }: { socket: any }) {
  const [lanes, setLanes] = useState<Lane[]>([]);
  // Wall-clock at which the next-scheduled item *starts* sliding.
  // We push it forward by ITEM_PITCH_PX/PX_PER_SEC each time we
  // enqueue, so even if 5 events arrive in a single frame they march
  // across one after another instead of overlapping.
  const nextStartRef = useRef<number>(0);
  // Wall-clock of the last enqueue (real or idle) — used by the idle
  // pump to decide whether the strip's been quiet long enough.
  const lastEnqueueRef = useRef<number>(0);
  // Cursor for round-robin idle message selection.
  const idleCursorRef = useRef<number>(Math.floor(Math.random() * IDLE_MESSAGES.length));

  function enqueue(ev: AnyEvent) {
    const now = Date.now();
    // Always derive duration from the current viewport width so it
    // works on any screen the player is cast to (the projector vs. a
    // dev laptop). Add VIEWPORT_OVERSHOOT_PX so even very long titles
    // get to fully exit before unmount.
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const durationMs = Math.round(((vw + VIEWPORT_OVERSHOOT_PX) / PX_PER_SEC) * 1000);
    const startAt = Math.max(now, nextStartRef.current);
    nextStartRef.current = startAt + (ITEM_PITCH_PX / PX_PER_SEC) * 1000;
    lastEnqueueRef.current = now;
    const lane: Lane = { ev, delayMs: startAt - now, durationMs };
    setLanes((prev) => prev.concat(lane));
  }

  // Subscribe to real events.
  useEffect(() => {
    if (!socket) return;
    const onEvent = (e: ActivityEventDTO) => enqueue(e);
    socket.on(SOCKET_EVENTS.activityEvent, onEvent);
    return () => {
      socket.off(SOCKET_EVENTS.activityEvent, onEvent);
    };
    // enqueue is stable enough — we only care about (re)attaching
    // when the socket itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // Idle pump: enqueue a house message whenever the strip's been
  // quiet for IDLE_QUIET_MS. Cheap timer (1 Hz). We also seed an
  // initial idle event a beat after mount so the strip isn't blank
  // when the player first comes up before any real activity.
  useEffect(() => {
    // Seed.
    const seed = setTimeout(() => {
      if (lastEnqueueRef.current === 0) enqueueIdle();
    }, 800);

    const t = setInterval(() => {
      if (Date.now() - lastEnqueueRef.current >= IDLE_QUIET_MS) {
        enqueueIdle();
      }
    }, 1000);

    return () => {
      clearTimeout(seed);
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function enqueueIdle() {
    const i = idleCursorRef.current % IDLE_MESSAGES.length;
    idleCursorRef.current = (idleCursorRef.current + 1) % IDLE_MESSAGES.length;
    const ev: IdleEvent = {
      id: 'idle_' + makeId(),
      kind: 'idle',
      ts: Date.now(),
      message: IDLE_MESSAGES[i],
    };
    enqueue(ev);
  }

  function drop(id: string) {
    setLanes((prev) => prev.filter((l) => l.ev.id !== id));
  }

  return (
    <footer className="ticker">
      {lanes.map((l) => (
        <TickerItem key={l.ev.id} lane={l} onDone={() => drop(l.ev.id)} />
      ))}
    </footer>
  );
}

function TickerItem({ lane, onDone }: { lane: Lane; onDone: () => void }) {
  const { ev, delayMs, durationMs } = lane;
  const style: React.CSSProperties & Record<string, string | number> = {
    // Per-item animation knobs — keyframes pick these up.
    ['--ticker-dur']: `${durationMs}ms`,
    ['--ticker-delay']: `${delayMs}ms`,
  };
  const isIdle = ev.kind === 'idle';
  return (
    <div
      className={`ticker-item ${isIdle ? 'ticker-item-idle' : ''}`}
      style={style}
      onAnimationEnd={onDone}
    >
      {isIdle ? (
        <>
          <span className="ticker-glyph" aria-hidden>
            🎵
          </span>
          <span className="ticker-text ticker-text-idle">{(ev as IdleEvent).message}</span>
        </>
      ) : (
        <>
          <Avatar
            id={(ev as ActivityEventDTO).actor.id}
            name={(ev as ActivityEventDTO).actor.name}
            src={(ev as ActivityEventDTO).actor.pictureUrl ?? null}
          />
          <span className="ticker-text">
            <strong className="ticker-name">{(ev as ActivityEventDTO).actor.name}</strong>
            <span className="ticker-verb"> {describe(ev as ActivityEventDTO)}</span>
            {(ev as ActivityEventDTO).track && (
              <span className="ticker-track-info">
                {' '}
                <span className="ticker-track-title">
                  {(ev as ActivityEventDTO).track!.title}
                </span>
                <span className="ticker-dim"> — {(ev as ActivityEventDTO).track!.artist}</span>
              </span>
            )}
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Map an event kind to the verb shown after the actor's name. Any new
 * `ActivityKind` must be added here — TS will warn (exhaustive switch
 * on a union) when one's missing.
 */
function describe(e: ActivityEventDTO): string {
  switch (e.kind) {
    case 'songAdded':
      return 'added';
    case 'voteUp':
      return 'upvoted';
    case 'voteDown':
      return 'downvoted';
    case 'userJoined':
      return 'joined the queue';
    default: {
      const _exhaustive: never = e.kind;
      return _exhaustive;
    }
  }
}

/**
 * Avatar with a deterministic colored fallback. We use a small string
 * hash → HSL hue so the same user always lands on the same color
 * across reloads.
 */
function Avatar({ id, name, src }: { id: string; name: string; src: string | null }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return (
      <img
        className="ticker-avatar"
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  }
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <div
      className="ticker-avatar ticker-avatar-fallback"
      style={{ background: colorFor(id || name) }}
    >
      {initial}
    </div>
  );
}

/** djb2-ish 32-bit hash → HSL hue. Stable + deterministic. */
function colorFor(seed: string): string {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 65% 45%)`;
}
