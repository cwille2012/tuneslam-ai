/**
 * Karma leaderboard panel for the player view.
 *
 * Rendered alongside the queue inside a CSS card-flipper; the parent
 * is responsible for showing/hiding it. This component is purely
 * presentational — it doesn't fetch on its own. The parent fetches
 * fresh data when a new song starts and passes it down so the panel
 * can flip in with up-to-date numbers.
 *
 * Visual goals:
 *   - readable from across the room on a TV-sized display
 *   - calm, no entry/exit animations on individual rows (the
 *     panel-level flip is plenty of motion for a wall display)
 *   - graceful degradation when avatars are missing (initials fallback)
 */

export interface LeaderboardEntry {
  rank: number;
  username: string;
  /** Profile picture URL (Facebook preferred, Spotify fallback). May be null. */
  picture: string | null;
  sessionKarma: number;
  songsPlayed: number;
  songsAdded: number;
}

/**
 * Lightweight initials avatar for users without a linked profile
 * picture. Pulls the first character of the username (uppercased)
 * and renders it inside the same circular slot as the real avatar
 * so the row alignment is identical regardless of source.
 */
function InitialAvatar({ username }: { username: string }) {
  const initial = (username || '?').trim().slice(0, 1).toUpperCase();
  return (
    <div className="leaderboard-avatar leaderboard-avatar-initial" aria-hidden>
      {initial}
    </div>
  );
}

export function Leaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <>
      <h3>Karma leaderboard</h3>
      {entries.length === 0 ? (
        <div className="mute">
          No karma yet — add a song or upvote one to get on the board!
        </div>
      ) : (
        <div className="list">
          {entries.map((row) => (
            <div
              key={row.rank}
              className={`leaderboard-row${row.rank <= 3 ? ' leaderboard-row-top' : ''}`}
            >
              <div className="pos">{row.rank}</div>
              {row.picture ? (
                <img
                  src={row.picture}
                  alt=""
                  className="leaderboard-avatar"
                  // CDN URLs can rotate (FB tokens expire, Spotify rotates
                  // image URLs). Hide a busted image cleanly so the layout
                  // doesn't shift, instead of showing a broken-image icon.
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <InitialAvatar username={row.username} />
              )}
              <div className="info">
                <div className="title">@{row.username}</div>
                <div className="sub">
                  {row.songsPlayed} played · {row.songsAdded} added
                </div>
              </div>
              <div className="votes">
                {row.sessionKarma >= 0 ? `+${row.sessionKarma}` : row.sessionKarma}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
