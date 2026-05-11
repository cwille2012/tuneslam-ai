import { useEffect, useState } from 'react';
import { api, errMsg } from '../lib/api';

export default function Blacklist() {
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState('');
  async function load() {
    try { const r = await api.get('/api/admin/blacklist'); setItems(r.data.items); }
    catch (e: any) { setErr(errMsg(e)); }
  }
  useEffect(() => { load(); }, []);
  async function remove(id: string) {
    try { await api.delete('/api/admin/blacklist/' + id); load(); }
    catch (e: any) { setErr(errMsg(e)); }
  }
  return (
    <div className="container">
      <h1>Blacklisted tracks</h1>
      {err && <div className="error">{err}</div>}
      {items.length === 0 && <div className="mute">No blacklisted tracks.</div>}
      <div className="list">
        {items.map((b) => (
          <div key={b.id} className="queue-item">
            <img src={b.albumArt || ''} alt="" />
            <div className="info"><div className="title">{b.trackName}</div><div className="sub">{b.artistsJoined}</div></div>
            <button className="btn btn-sm btn-danger" onClick={() => remove(b.id)}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}
