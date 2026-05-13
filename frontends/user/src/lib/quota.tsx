import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { api } from './api';

/**
 * Per-session per-user quota snapshot returned by the backend.
 *
 * `maxSongsPerHour` / `maxVotesPerHour` of 0 means the admin has not
 * set a limit — the popup omits that line entirely. The countdown is
 * only shown when at least one *enabled* limit is currently exhausted.
 */
export interface QuotaSnapshot {
  maxSongsPerHour: number;
  maxVotesPerHour: number;
  songsUsedThisHour: number;
  votesUsedThisHour: number;
  /** ISO timestamp at which the rolling hour window resets. */
  resetsAt: string;
}

interface QuotaContextValue {
  /** Current snapshot, or null while we haven't fetched yet / not in a session. */
  snapshot: QuotaSnapshot | null;
  /** Force a refresh — call after any add/vote so the popup stays accurate. */
  refresh: () => Promise<void>;
}

const QuotaContext = createContext<QuotaContextValue>({
  snapshot: null,
  refresh: async () => {},
});

/**
 * Routes that aren't a session-view. We exclude them when sniffing
 * the slug from `location.pathname`. Anything else that's a single
 * top-level segment (`/cool-bar`) is assumed to be a session slug.
 */
const NON_SESSION_PATHS = new Set([
  '',
  'login',
  'register',
  'account',
  'facebook',
  'spotify',
]);

function slugFromPath(pathname: string): string | null {
  const parts = pathname.replace(/^\//, '').split('/');
  const first = parts[0] ?? '';
  if (!first) return null;
  if (NON_SESSION_PATHS.has(first)) return null;
  // Multi-segment paths under a known prefix (e.g. `/facebook/callback`)
  // are caught by the set check above; anything else is taken as a slug.
  return first.toLowerCase();
}

interface ProviderProps {
  /** Whether the user is logged in. The provider is a no-op otherwise. */
  loggedIn: boolean;
  children: ReactNode;
}

/**
 * Wrap the user app with this so the Activity button (and SessionView)
 * can read + invalidate quota state without each component fetching
 * independently.
 *
 * Only fetches when:
 *   - the user is logged in, AND
 *   - the current path looks like a session slug.
 *
 * Polls every 30 s while mounted to keep the displayed numbers and
 * countdown accurate even without explicit refresh calls.
 */
export function QuotaProvider({ loggedIn, children }: ProviderProps) {
  const { pathname } = useLocation();
  const slug = slugFromPath(pathname);
  const [snapshot, setSnapshot] = useState<QuotaSnapshot | null>(null);
  // Stable ref to the current slug so the polling effect can read it
  // without resubscribing on every render.
  const slugRef = useRef<string | null>(slug);
  slugRef.current = slug;

  const refresh = useCallback(async () => {
    const s = slugRef.current;
    if (!s || !loggedIn) {
      setSnapshot(null);
      return;
    }
    try {
      const r = await api.get(`/api/user/sessions/${s}/quota`);
      setSnapshot(r.data as QuotaSnapshot);
    } catch {
      // 404 (session gone), 401 (logged out), etc. — fall back to
      // hidden state. The UI just won't render the button.
      setSnapshot(null);
    }
  }, [loggedIn]);

  // Refetch whenever the slug or login state changes.
  useEffect(() => {
    refresh();
  }, [slug, loggedIn, refresh]);

  // Background poll. 30 s feels right — quota changes via in-app
  // adds/votes already trigger an immediate `refresh()` from the
  // SessionView, so this is mostly to catch the hourly rollover.
  useEffect(() => {
    if (!slug || !loggedIn) return;
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [slug, loggedIn, refresh]);

  const value = useMemo(() => ({ snapshot, refresh }), [snapshot, refresh]);
  return <QuotaContext.Provider value={value}>{children}</QuotaContext.Provider>;
}

export function useQuota(): QuotaContextValue {
  return useContext(QuotaContext);
}

/** True when the configured-and-enabled limit is exhausted. */
export function isAnyLimitExhausted(s: QuotaSnapshot): boolean {
  return (
    (s.maxSongsPerHour > 0 && s.songsUsedThisHour >= s.maxSongsPerHour) ||
    (s.maxVotesPerHour > 0 && s.votesUsedThisHour >= s.maxVotesPerHour)
  );
}

/** True when the user app should render the Activity button at all. */
export function hasAnyLimit(s: QuotaSnapshot | null): s is QuotaSnapshot {
  return !!s && (s.maxSongsPerHour > 0 || s.maxVotesPerHour > 0);
}
