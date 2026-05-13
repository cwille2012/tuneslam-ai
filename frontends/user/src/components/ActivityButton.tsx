import { useEffect, useRef, useState } from 'react';
import {
  hasAnyLimit,
  isAnyLimitExhausted,
  useQuota,
  type QuotaSnapshot,
} from '../lib/quota';

/**
 * Small "Activity" button that lives in the global nav, just to the
 * left of the Logout button. Visible only when:
 *
 *   - The user is logged in (parent gates this; we don't see the
 *     account here, just rely on the snapshot being null otherwise),
 *     AND
 *   - The current route is a session view, AND
 *   - The session has at least one of: `maxSongsPerUserPerHour > 0`
 *     or `maxVotesPerUserPerHour > 0` (per spec — if neither limit is
 *     set, the button hides entirely).
 *
 * Clicking opens a small popover anchored below the button with:
 *
 *   - "Songs remaining: X / max"  (only if max songs > 0)
 *   - "Votes remaining: Y / max"  (only if max votes > 0)
 *   - "Resets in: Mm Ss"          (only if at least one *enabled*
 *                                  limit is currently exhausted —
 *                                  per spec)
 */
export default function ActivityButton() {
  const { snapshot, refresh } = useQuota();
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // Close on outside-click. We don't bother with a portal — the
  // popover is just a positioned div inside the nav element, and
  // outside-click is the standard close affordance.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (popRef.current?.contains(target)) return;
      if (btnRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Spec: button is hidden entirely when neither limit is configured.
  if (!hasAnyLimit(snapshot)) return null;

  return (
    <div className="activity-wrap">
      <button
        ref={btnRef}
        className="btn btn-sm"
        onClick={() => {
          // Refetch on open so the count is up-to-date even if the
          // 30 s background poll hasn't fired yet.
          if (!open) refresh();
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        Activity
      </button>
      {open && (
        <div ref={popRef} className="activity-popover" role="dialog" aria-label="Activity">
          <ActivityPopoverContent snapshot={snapshot} />
        </div>
      )}
    </div>
  );
}

function ActivityPopoverContent({ snapshot }: { snapshot: QuotaSnapshot }) {
  const { refresh } = useQuota();
  const exhausted = isAnyLimitExhausted(snapshot);
  // Only tick the countdown while we're actually showing it.
  const [, setNow] = useState(0);
  useEffect(() => {
    if (!exhausted) return;
    const t = setInterval(() => setNow((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [exhausted]);

  // When the countdown hits zero, refetch so the new window's counts
  // (typically 0 used) populate and the clock disappears.
  const resetsAtMs = new Date(snapshot.resetsAt).getTime();
  const remainingMs = Math.max(0, resetsAtMs - Date.now());
  useEffect(() => {
    if (!exhausted) return;
    if (remainingMs > 0) return;
    refresh();
  }, [exhausted, remainingMs, refresh]);

  const songsRemaining = snapshot.maxSongsPerHour > 0
    ? Math.max(0, snapshot.maxSongsPerHour - snapshot.songsUsedThisHour)
    : null;
  const votesRemaining = snapshot.maxVotesPerHour > 0
    ? Math.max(0, snapshot.maxVotesPerHour - snapshot.votesUsedThisHour)
    : null;

  return (
    <div className="col" style={{ gap: 8 }}>
      <div style={{ fontWeight: 600 }}>Your activity</div>
      {songsRemaining !== null && (
        <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
          <span className="mute">Songs remaining</span>
          <span><strong>{songsRemaining}</strong> / {snapshot.maxSongsPerHour}</span>
        </div>
      )}
      {votesRemaining !== null && (
        <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
          <span className="mute">Votes remaining</span>
          <span><strong>{votesRemaining}</strong> / {snapshot.maxVotesPerHour}</span>
        </div>
      )}
      {exhausted && (
        <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
          <span className="mute">Resets in</span>
          <span><strong>{formatRemaining(remainingMs)}</strong></span>
        </div>
      )}
    </div>
  );
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  // Always pad seconds; minutes don't need padding (max 59).
  return `${m}m ${String(s).padStart(2, '0')}s`;
}
