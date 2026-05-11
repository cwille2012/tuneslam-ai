import { useEffect, useState } from 'react';
import { api, errMsg } from '../lib/api';

export default function History() {
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    api.get('/api/admin/session/history').then((r) => setItems(r.data.items)).catch((e) => setErr(errMsg(e)));
  }, []);
  return (
    <div className="container">
      <h1>Play history</h1>
      {err && <div className="error">{err}</div>}
      <div className="list">
        {items.length === 0 && <div className="mute">No songs played yet.</div>}
        {items.map((h) => (
          <div key={h.id} className="queue-item">
            <img src={h.track.albumArt || ''} alt="" />
            <div className="info">
              <div className="title">{h.track.name}</div>
              <div className="sub">{h.track.artists.map((a: any) => a.name).join(', ')} · added by {h.addedBy.label}</div>
            </div>
            <div className="mute">{new Date(h.playedAt).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
