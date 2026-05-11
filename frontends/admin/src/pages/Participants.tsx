import { useEffect, useState } from 'react';
import { api, errMsg } from '../lib/api';

export default function Participants() {
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState('');
  async function load() {
    try { const r = await api.get('/api/admin/session/participants'); setItems(r.data.participants); }
    catch (e: any) { setErr(errMsg(e)); }
  }
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, []);
  async function block(id: string, blocked: boolean) {
    try { await api.post(`/api/admin/session/participants/${id}/block`, { blocked }); load(); }
    catch (e: any) { setErr(errMsg(e)); }
  }
  return (
    <div className="container">
      <h1>Participants</h1>
      {err && <div className="error">{err}</div>}
      <table>
        <thead><tr><th>User</th><th>Joined</th><th>Last seen</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <td>@{p.username}</td>
              <td>{new Date(p.joinedAt).toLocaleString()}</td>
              <td>{new Date(p.lastSeen).toLocaleString()}</td>
              <td>{p.blocked ? <span className="tag warn">blocked</span> : p.online ? <span className="tag locked">online</span> : <span className="tag">offline</span>}</td>
              <td>{p.blocked
                ? <button className="btn btn-sm" onClick={() => block(p.id, false)}>Unblock</button>
                : <button className="btn btn-sm btn-danger" onClick={() => block(p.id, true)}>Block</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
