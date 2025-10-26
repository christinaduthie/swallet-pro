import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";

export default function GroupDetail() {
  const { id } = useParams();
  const [group, setGroup] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState("spend");

  useEffect(() => {
    async function loadGroup() {
      try {
        const g = await api.get(`/groups/${id}`);
        const l = await api.get(`/groups/${id}/ledger`);
        setGroup(g);
        setLedger(l);
      } catch (err) {
        console.error(err);
        setError("Failed to load group details.");
      } finally {
        setLoading(false);
      }
    }
    loadGroup();
  }, [id]);

  async function addTransaction(e) {
    e.preventDefault();
    try {
      await api.post("/transactions", {
        group_id: id,
        type,
        amount_cents: Math.round(Number(amount) * 100),
        description: desc,
      });
      const updated = await api.get(`/groups/${id}/ledger`);
      setLedger(updated);
      setAmount("");
      setDesc("");
    } catch (err) {
      console.error(err);
      alert("Failed to add transaction.");
    }
  }

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!group) return <p>No group found.</p>;

  const formatAmount = (value = 0) =>
    new Intl.NumberFormat("en", {
      style: "currency",
      currency: group.currency || "USD",
    }).format(value);

  return (
    <div className="page-stack">
      <section className="card">
        <p className="eyebrow">Group</p>
        <h2 style={{ margin: 0 }}>{group.name}</h2>
        <div className="stat-grid" style={{ marginTop: "1rem" }}>
          <div className="stat-card">
            <h3>Currency</h3>
            <strong>{group.currency}</strong>
            <p className="muted">Base currency for conversions.</p>
          </div>
          <div className="stat-card">
            <h3>Members</h3>
            <strong>{group.members?.length || 0}</strong>
            <p className="muted">Actively sharing expenses.</p>
          </div>
          <div className="stat-card">
            <h3>Total paid</h3>
            <strong>{formatAmount((group.paid_cents || 0) / 100)}</strong>
            <p className="muted">Synced from the ledger.</p>
          </div>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Add transaction</p>
        <form className="form-grid" onSubmit={addTransaction}>
          <div className="form-field">
            <label htmlFor="amount">Amount</label>
            <input
              id="amount"
              className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              type="number"
              min="0"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="type">Type</label>
            <select
              id="type"
              className="select"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="spend">Spend</option>
              <option value="collect">Collect</option>
              <option value="reimburse">Reimburse</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="description">Description</label>
            <input
              id="description"
              className="input"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Dinner at Mercado"
            />
          </div>
          <div className="form-field align-end">
            <button type="submit" className="btn btn-primary">
              Add transaction
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <p className="eyebrow">Ledger</p>
        <h2 style={{ margin: "0 0 1rem" }}>Transactions</h2>
        {ledger.length === 0 ? (
          <p className="muted">No transactions yet.</p>
        ) : (
          <ul className="list">
            {ledger.map((t) => (
              <li key={t.id} className="list-item transaction-row">
                <div>
                  <strong style={{ textTransform: "capitalize" }}>{t.type}</strong>
                  <p className="muted">{t.description || "No description"}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong>{formatAmount((t.amount_cents || 0) / 100)}</strong>
                  <p className="muted">{t.status}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
