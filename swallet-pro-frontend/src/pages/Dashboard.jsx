import React, { useEffect, useState } from "react";
import { api } from "../api"; // adjust if needed (../utils/api if moved later)

export default function Dashboard() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadGroups() {
      try {
        const data = await api.get("/groups");
        setGroups(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load groups. Please check your backend connection.");
      } finally {
        setLoading(false);
      }
    }
    loadGroups();
  }, []);

  if (loading)
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <h3>Loading groups...</h3>
      </div>
    );

  if (error)
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p style={{ color: "red" }}>{error}</p>
      </div>
    );

  return (
    <div style={{ minHeight: "100vh", padding: 24 }}>
      <h1 style={{ textAlign: "center" }}>Dashboard</h1>
      {groups.length === 0 ? (
        <p style={{ textAlign: "center" }}>No groups yet. Try creating one!</p>
      ) : (
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          {groups.map((g) => (
            <div
              key={g.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 16,
                marginBottom: 12,
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
              }}
            >
              <h3 style={{ marginBottom: 4 }}>{g.name}</h3>
              <p style={{ margin: 0 }}>
                Currency: <strong>{g.currency}</strong>
              </p>
              <p style={{ margin: "4px 0 0 0", color: "#555" }}>
                Paid: ${(g.paid_cents / 100).toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
