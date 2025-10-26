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

  return (
    <div style={{ padding: "2rem", maxWidth: 600, margin: "auto", color: "#fff" }}>
      <h1>{group.name}</h1>
      <p>Currency: {group.currency}</p>
      <p>Members: {group.members?.length || 0}</p>

      {/* Add Transaction */}
      <form
        onSubmit={addTransaction}
        style={{
          marginTop: "1rem",
          padding: "1rem",
          background: "#222",
          borderRadius: "8px",
        }}
      >
        <h3>Add Transaction</h3>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          type="number"
          required
          style={{
            padding: "0.5rem",
            marginRight: "0.5rem",
            borderRadius: "4px",
            border: "1px solid #555",
            width: "30%",
          }}
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={{
            padding: "0.5rem",
            marginRight: "0.5rem",
            borderRadius: "4px",
            border: "1px solid #555",
          }}
        >
          <option value="spend">Spend</option>
          <option value="collect">Collect</option>
          <option value="reimburse">Reimburse</option>
        </select>
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Description"
          style={{
            padding: "0.5rem",
            marginRight: "0.5rem",
            borderRadius: "4px",
            border: "1px solid #555",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "0.5rem 1rem",
            background: "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Add
        </button>
      </form>

      {/* Ledger List */}
      <div style={{ marginTop: "2rem" }}>
        <h2>Transactions</h2>
        {ledger.length === 0 ? (
          <p>No transactions yet.</p>
        ) : (
          <ul>
            {ledger.map((t) => (
              <li key={t.id} style={{ marginBottom: "0.5rem" }}>
                <strong>{t.type}</strong> — ${t.amount_cents / 100} |{" "}
                {t.description || "No description"} | {t.status}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
