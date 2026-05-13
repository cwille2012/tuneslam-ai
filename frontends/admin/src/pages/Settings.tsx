import { useEffect, useState } from 'react';
import { api, errMsg } from '../lib/api';

export default function Settings() {
  const [s, setS] = useState<any>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/api/admin/session').then((r) => setS(r.data.session?.settings ? r.data.session : null)).catch(() => {});
    // Spotify deprecated /recommendations + /available-genre-seeds for new
    // apps in late 2024. Backend returns [] in that case (instead of 500),
    // and we use that emptiness to hide the now-useless autofill modes.
    api.get('/api/admin/spotify/genres').then((r) => setGenres(r.data.genres || [])).catch(() => setGenres([]));
    api.get('/api/admin/spotify/playlists').then((r) => setPlaylists(r.data.items)).catch(() => {});
  }, []);

  if (!s) return <div className="container"><div className="mute">No session.</div></div>;
  const settings = s.settings;
  const set = (k: string, v: any) => setS({ ...s, settings: { ...s.settings, [k]: v } });

  // If Spotify's recommendations API isn't available to this app, hide the
  // modes that depend on it. The user can still pick "off" or "playlist".
  const recommendationsAvailable = genres.length > 0;

  async function save() {
    setErr(''); setMsg('');
    try {
      await api.patch('/api/admin/session/settings', settings);
      setMsg('Saved.');
    } catch (e: any) { setErr(errMsg(e)); }
  }

  return (
    <div className="container col" style={{ maxWidth: 720 }}>
      <h1>Session settings</h1>
      {err && <div className="error">{err}</div>}
      {msg && <div className="notice">{msg}</div>}

      <div><label>Popularity threshold (0–100)</label>
        <input type="number" min={0} max={100} value={settings.popularityThreshold} onChange={(e) => set('popularityThreshold', Number(e.target.value))} />
        <div className="mute">Tracks under this popularity are rejected. 0 = allow all.</div>
      </div>
      <div><label>Max song length (minutes)</label>
        <input type="number" min={0} value={Math.round((settings.maxSongLengthMs || 0) / 60000)}
          onChange={(e) => set('maxSongLengthMs', Math.max(0, Number(e.target.value)) * 60000)} />
        <div className="mute">0 = no limit.</div>
      </div>
      <div><label>Lock-ahead time (seconds)</label>
        <input type="number" min={5} max={120} value={settings.lockAheadSec} onChange={(e) => set('lockAheadSec', Number(e.target.value))} />
      </div>
      <div><label>Max songs per user per hour</label>
        <input type="number" min={0} value={settings.maxSongsPerUserPerHour} onChange={(e) => set('maxSongsPerUserPerHour', Number(e.target.value))} />
        <div className="mute">0 = unlimited.</div>
      </div>
      <div><label>Allow re-add of recently played</label>
        <select value={String(settings.allowReadd)} onChange={(e) => set('allowReadd', e.target.value === 'true')}>
          <option value="false">No</option><option value="true">Yes</option>
        </select>
      </div>

      <h2 style={{ marginTop: 12 }}>Downvotes</h2>
      <div>
        <label>Downvote behavior</label>
        <select
          value={settings.downvoteBehavior ?? 'standard'}
          onChange={(e) => set('downvoteBehavior', e.target.value)}
        >
          <option value="standard">Standard</option>
          <option value="disabled">No downvotes</option>
          <option value="noEffectOnOrder">Downvotes don't affect order</option>
        </select>
        <div className="mute">
          <strong>Standard</strong> — downvotes count toward queue order
          and the downvote threshold.<br />
          <strong>No downvotes</strong> — hides the downvote button for
          users and admins; only upvotes are allowed.<br />
          <strong>Downvotes don't affect order</strong> — downvotes are
          hidden from the queue display, but still trigger removal once
          the downvote threshold is met.
        </div>
      </div>
      <div>
        <label>Downvote threshold (skip when ≤)</label>
        <input
          type="number"
          min={0}
          value={settings.downvoteThreshold}
          disabled={settings.downvoteBehavior === 'disabled'}
          onChange={(e) => set('downvoteThreshold', Number(e.target.value))}
        />
        <div className="mute">
          A song with this many net downvotes gets removed. 0 = disabled.
          {settings.downvoteBehavior === 'disabled' && (
            <> Ignored while downvotes are disabled.</>
          )}
        </div>
      </div>


      <h2 style={{ marginTop: 12 }}>Autofill</h2>
      <div><label>Mode</label>
        <select value={settings.autofillMode} onChange={(e) => set('autofillMode', e.target.value)}>
          <option value="off">Off</option>
          <option value="playlist">From playlist</option>
          {recommendationsAvailable && <option value="related">Related to recent tracks</option>}
          {recommendationsAvailable && <option value="genre">By genre</option>}
        </select>
        {!recommendationsAvailable && (
          <div className="mute">
            Tip: pick a Spotify playlist to keep the music going when no one
            adds songs. (Spotify's "related" and "genre" recommendations are
            no longer available to new apps.)
          </div>
        )}
      </div>
      {settings.autofillMode === 'playlist' && (
        <div><label>Playlist</label>
          <select value={settings.autofillPlaylistId || ''} onChange={(e) => set('autofillPlaylistId', e.target.value)}>
            <option value="">(choose)</option>
            {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}
      {settings.autofillMode === 'genre' && recommendationsAvailable && (
        <div><label>Genre</label>
          <select value={settings.autofillGenre || ''} onChange={(e) => set('autofillGenre', e.target.value)}>
            <option value="">(choose)</option>
            {genres.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      )}
      <div><label>Min queued before autofill kicks in</label>
        <input type="number" min={0} max={20} value={settings.autofillMin} onChange={(e) => set('autofillMin', Number(e.target.value))} />
      </div>

      <div className="row">
        <button className="btn btn-primary" onClick={save}>Save</button>
      </div>
    </div>
  );
}
