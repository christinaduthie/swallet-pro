import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Groups() {
  const nav = useNavigate();
  const [groups, setGroups] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", currency: "USD" });
  const [err, setErr] = useState("");

  async function load() {
    try {
      const data = await api.get("/groups");
      setGroups(data);
    } catch (e) {
      console.error(e);
      setErr("Failed to load groups");
    }
  }

  useEffect(() => { load(); }, []);
  async function createGroup(e) {
    e.preventDefault();
    setErr("");
    try {
      const g = await api.post("/groups", form);
      setShowNew(false);
      setForm({ name: "", currency: "USD" });
      nav(`/groups/${g.id}`);
    } catch (e) {
      console.error(e);
      setErr("Failed to create group");
    }
  }

  async function seed() {
    await api.post("/api/seed");
    load();
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <h1>Groups</h1>
        <div style={{ display:"flex", gap: 8 }}>
          <button onClick={() => setShowNew(true)}>+ New Group</button>
          <button onClick={seed}>Seed Demo</button>
        </div>
      </div>

      {err && <div style={{ color:"#b91c1c" }}>{err}</div>}

      <div style={{ display:"grid", gap:12, marginTop:16 }}>
        {groups.map(g => (
          <div key={g.id} style={{ border:"1px solid #e5e7eb", borderRadius:12, padding:16, cursor:"pointer" }}
               onClick={() => nav(`/groups/${g.id}`)}>
            <div style={{ fontWeight:600 }}>{g.name}</div>
            <div style={{ fontSize:14, opacity:.7 }}>
              Paid total: {(g.paid_cents/100).toLocaleString(undefined,{style:"currency",currency:g.currency})}
            </div>
          </div>
        ))}
        {groups.length === 0 && <div>No groups yet.</div>}
      </div>

      {showNew && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.4)", display:"grid", placeItems:"center" }}>
          <form onSubmit={createGroup} style={{ background:"#fff", padding:20, borderRadius:12, width:360, display:"grid", gap:12 }}>
            <h3 style={{ margin:0 }}>Create Group</h3>
            <label>
              Name
              <input value={form.name} onChange={e=>setForm(s=>({...s, name:e.target.value}))} required style={{ width:"100%" }}/>
            </label>
            <label>
              Currency
              <select value={form.currency} onChange={e=>setForm(s=>({...s, currency:e.target.value}))}>
                <option>USD</option><option>EUR</option><option>INR</option>
              </select>
            </label>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button type="button" onClick={()=>setShowNew(false)}>Cancel</button>
              <button type="submit">Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
