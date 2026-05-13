import type { SessionParticipantDoc } from '../models/SessionParticipant';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Roll over a participant's hourly quota window if it has expired.
 *
 * `SessionParticipant.quotaHourStart` is the single source of truth for
 * both `songsUsedThisHour` and `votesUsedThisHour` (the two limits are
 * spec'd to reset together for any given user). When the elapsed time
 * since `quotaHourStart` reaches one hour, all counters reset and
 * `quotaHourStart` is moved forward to *now*.
 *
 * Mutates `p` in place. Caller is responsible for `p.save()` — we
 * don't save here so callers that also want to bump a counter can
 * batch both writes into one save.
 *
 * Returns `true` if the window rolled over, `false` otherwise. Mostly
 * useful for tests / logging.
 */
export function rolloverQuotaIfExpired(
  p: SessionParticipantDoc,
  now: Date = new Date(),
): boolean {
  // `quotaHourStart` is defaulted server-side, but defend against
  // legacy docs that pre-date the field. (`undefined` is treated as
  // "expired" so the quota starts cleanly from this call.)
  if (
    !p.quotaHourStart ||
    now.getTime() - p.quotaHourStart.getTime() >= HOUR_MS
  ) {
    p.quotaHourStart = now;
    p.songsUsedThisHour = 0;
    p.votesUsedThisHour = 0;
    return true;
  }
  return false;
}

/** When the current hourly window resets. */
export function quotaResetsAt(p: SessionParticipantDoc): Date {
  const start = p.quotaHourStart ? p.quotaHourStart.getTime() : Date.now();
  return new Date(start + HOUR_MS);
}
