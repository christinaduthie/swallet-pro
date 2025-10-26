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
    <div className="page-stack">
      <section className="card">
        <div className="page-header-sm">
          <div>
            <p className="eyebrow">Groups</p>
            <h2 style={{ margin: 0 }}>Shared spaces</h2>
            <p className="muted">
              Organize trips, households, or side projects. Everything stays in sync.
            </p>
          </div>
          <div className="header-actions">
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>
              + New group
            </button>
            <button className="btn btn-ghost" onClick={seed}>
              Seed demo
            </button>
          </div>
        </div>

        {err && <div style={{ color: "#b91c1c", marginTop: "1rem" }}>{err}</div>}

        <div className="group-grid" style={{ marginTop: "1.5rem" }}>
          {groups.map((g) => (
            <div key={g.id} className="group-card group-card--link" onClick={() => nav(`/groups/${g.id}`)}>
              <div>
                <strong>{g.name}</strong>
                <p className="muted">Currency: {g.currency}</p>
              </div>
              <div className="group-card__value">
                <span>Paid total</span>
                <strong>
                  {(g.paid_cents / 100).toLocaleString(undefined, {
                    style: "currency",
                    currency: g.currency,
                  })}
                </strong>
              </div>
            </div>
          ))}
          {groups.length === 0 && <p className="muted">No groups yet.</p>}
        </div>
      </section>

      {showNew && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-card" onSubmit={createGroup}>
            <h3 style={{ margin: 0 }}>Create group</h3>
            <label className="form-field">
              <span>Name</span>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                required
              />
            </label>
            <label className="form-field">
              <span>Currency</span>
              <select
                className="select"
                value={form.currency}
                onChange={(e) => setForm((s) => ({ ...s, currency: e.target.value }))}
              >
                <option>USD</option>
                <option>EUR</option>
                <option>INR</option>
              </select>
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowNew(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
