import { Link } from 'react-router-dom';
import { ADMIN_URL } from '../lib/api';

/**
 * Public landing page for the user-facing site.
 *
 * The page intentionally does NOT let visitors enter a session slug
 * and walk in. Per spec, joining a session requires being physically
 * at the venue and scanning its QR code — we don't surface a public
 * directory of active rooms, and slug-typing is removed.
 *
 * The page splits visitors into two journeys:
 *
 *   1. Listeners ("I'm at a venue and want to influence the music") —
 *      told to scan the on-site QR code. A "find a session near me"
 *      button is shown but kept disabled with a "coming soon" caption,
 *      so the affordance exists without enabling drive-by joining.
 *
 *   2. Hosts / venue owners — handed a primary CTA to the admin
 *      signup page (via VITE_ADMIN_URL). Falls back to the user-app
 *      `/login` when the admin URL isn't configured (rare but tidy).
 *
 * Layout uses CSS grid with auto-fit columns so the page collapses
 * cleanly from a two-up desktop layout to a single-column phone
 * layout without explicit media queries.
 */
export default function Landing() {
  // Admin URLs are env-configured. If VITE_ADMIN_URL is missing, link
  // to the user login as a non-broken fallback (the admin app might
  // be served from the same host in dev).
  const adminSignupHref = ADMIN_URL ? `${ADMIN_URL}/register` : '/login';
  const adminLoginHref = ADMIN_URL ? `${ADMIN_URL}/login` : '/login';

  return (
    <div className="landing">
      <section className="landing-hero">
        <div className="landing-brand">TuneSlam</div>
        <h1 className="landing-headline">The crowd picks the music.</h1>
        <p className="landing-sub">
          TuneSlam lets the people in the room shape what plays next. Add a song,
          vote on what's queued, and watch the lineup rearrange itself in real
          time — no DJ required.
        </p>
        <div className="landing-cta-row">
          <a href="#listener" className="btn btn-primary landing-cta">
            I'm here to listen
          </a>
          <a href="#host" className="btn landing-cta">
            Run music at my venue
          </a>
        </div>
      </section>

      <section className="landing-howit">
        <h2 className="landing-section-title">How it works</h2>
        <div className="landing-feature-grid">
          <div className="landing-feature">
            <div className="landing-feature-icon" aria-hidden>
              {/* QR-ish icon */}
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <path d="M14 14h3v3h-3zM18 18h3v3h-3z" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <h3>Scan to join</h3>
            <p>
              Snap the QR code at the venue. That's the only way in — no public
              directory, no random rooms.
            </p>
          </div>
          <div className="landing-feature">
            <div className="landing-feature-icon" aria-hidden>
              {/* Music note icon */}
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <h3>Add &amp; vote</h3>
            <p>
              Drop a song into the queue, or upvote what's already there. The
              tracks the room wants float to the top.
            </p>
          </div>
          <div className="landing-feature">
            <div className="landing-feature-icon" aria-hidden>
              {/* Bars icon */}
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="10" width="3" height="10" />
                <rect x="10" y="4" width="3" height="16" />
                <rect x="16" y="13" width="3" height="7" />
              </svg>
            </div>
            <h3>Live shuffle</h3>
            <p>
              The highest-voted track plays next. The room decides, song after
              song, in real time.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-paths">
        <div className="landing-card" id="listener">
          <h2>Joining a session</h2>
          <p>
            You join a TuneSlam session by scanning the QR code at the venue
            you're in. We don't list active sessions publicly — you have to be
            there to take part.
          </p>
          <p className="mute">
            If you're already at a spot using TuneSlam, look for the QR code near
            the bar, the stage, or in the bathroom.
          </p>
          <button
            className="btn"
            disabled
            title="Coming soon — for now, scan a QR code on-site."
          >
            Find a session near me
          </button>
          <div className="mute landing-cta-caption">
            Coming soon — for now, scan a QR code on-site.
          </div>
          <div className="landing-card-footer">
            <span className="mute">Already have an account?</span>{' '}
            <Link to="/login">Log in</Link>
          </div>
        </div>

        <div className="landing-card landing-card-accent" id="host">
          <h2>Running music at your venue</h2>
          <p>
            Get the crowd involved without giving up the aux. TuneSlam runs in
            any browser — print the QR code, point it at the room, and let
            people add songs while you stay in control of the room.
          </p>
          <p className="mute">
            Block tracks you never want to hear, lock songs that have to play,
            set per-hour limits, and skip anything that's not the vibe.
          </p>
          <a className="btn btn-primary" href={adminSignupHref}>
            Create a venue account
          </a>
          <div className="landing-card-footer">
            <span className="mute">Already a host?</span>{' '}
            <a href={adminLoginHref}>Log in to your venue</a>
          </div>
        </div>
      </section>

      <footer className="landing-footer mute">
        <div>TuneSlam is in active development. Spotted a bug? Let us know.</div>
        <div>© TuneSlam</div>
      </footer>
    </div>
  );
}
