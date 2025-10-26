import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";

export default function GroupDetail() {
  const { id } = useParams();
  const [group, setGroup] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [err, setErr] = useState("");
  const [showReq, setShowReq] = useState(false);
  const [reqForm, setReqForm] = useState({ type:"spend", amount: "", description:"" });

  async function load() {
    try {
      const g = await api.get(`/api/groups/${id}`);
      setGroup(g);
      const l = await api.get(`/api/groups/${id}/ledger`);
      setLedger(l);
    } catch (e) {
      setErr("Failed to load group");
    }
  }
  useEffect(()=>{ load(); }, [id]);

  async function submitRequest(e) {
    e.preventDefault();
    setErr("");
    const cents = Math.round(Number(reqForm.amount) * 100);
    if (!cents) return setErr("Amount invalid");
    try {
      await api.post("/api/transactions", {
        group_id: id,
        type: reqForm.type,
        amount_cents: cents,
        description: reqForm.description
      });
      setShowReq(false);
      setReqForm({ type:"spend", amount:"", description:"" });
      load();
    } catch(e) {
      setErr("Could not create request");
    }
  }

  async function approve(txId, decision="approve") {
    await api.post(`/api/approvals/${txId}`, { decision });
    load();
  }

  if (!group) return <div style={{ padding:24 }}>Loading…</div>;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <h1>{group.name}</h1>
        <button onClick={()=>setShowReq(true)}>+ New Request</button>
      </div>

      {err && <div style={{ color:"#b91c1c" }}>{err}</div>}

      <h3>Members</h3>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {group.members.map(m => (
          <span key={m.email} style={{ padding:"6px 10px", border:"1px solid #e5e7eb", borderRadius:999 }}>
            {m.email} · {m.role}
          </span>
        ))}
      </div>

      <h3 style={{ marginTop:20 }}>Ledger</h3>
      <div style={{ display:"grid", gap:8 }}>
        {ledger.map(tx => (
          <div key={tx.id} style={{ border:"1px solid #e5e7eb", borderRadius:12, padding:12, display:"grid", gridTemplateColumns:"1fr auto auto", alignItems:"center", gap:8 }}>
            <div>
              <div style={{ fontWeight:600 }}>{tx.description || tx.type}</div>
              <div style={{ fontSize:13, opacity:.7 }}>{new Date(tx.created_at).toLocaleString()}</div>
            </div>
            <div style={{ fontWeight:600 }}>
              {(tx.amount_cents/100).toLocaleString(undefined,{style:"currency",currency: group.currency})}
            </div>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <span style={{ fontSize:12, padding:"2px 8px", borderRadius:999, background:"#f1f5f9" }}>{tx.status}</span>
              {tx.status === "pending" && (
                <>
                  <button onClick={()=>approve(tx.id,"approve")}>Approve</button>
                  <button onClick={()=>approve(tx.id,"reject")}>Reject</button>
                </>
              )}
            </div>
          </div>
        ))}
        {ledger.length === 0 && <div>No transactions yet.</div>}
      </div>

      {showReq && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.4)", display:"grid", placeItems:"center" }}>
          <form onSubmit={submitRequest} style={{ background:"#fff", padding:20, borderRadius:12, width:380, display:"grid", gap:12 }}>
            <h3 style={{ margin:0 }}>New Request</h3>
            <label>
              Type
              <select value={reqForm.type} onChange={e=>setReqForm(s=>({...s, type:e.target.value}))}>
                <option value="spend">Spend</option>
                <option value="collect">Collect</option>
                <option value="reimburse">Reimburse</option>
              </select>
            </label>
            <label>
              Amount
              <input type="number" step="0.01" value={reqForm.amount} onChange={e=>setReqForm(s=>({...s, amount:e.target.value}))} required />
            </label>
            <label>
              Description
              <input value={reqForm.description} onChange={e=>setReqForm(s=>({...s, description:e.target.value}))}/>
            </label>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button type="button" onClick={()=>setShowReq(false)}>Cancel</button>
              <button type="submit">Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
