import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { api } from "../api";

export default function Dashboard() {
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");

  const navigate = useNavigate();
  const { isAuthenticated, isLoading, authError, user } = useAuth0();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        localStorage.removeItem("token");
        navigate("/", { replace: true });
      } else if (user?.email) {
        localStorage.setItem("token", `fake|${user.email}`);
      }
    }
    async function loadGroups() {
      try {
        const data = await api.get("/groups");
        setGroups(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error loading groups:", err);
        setError("Failed to load groups. Please check your backend connection.");
      } finally {
        setLoading(false);
      }
    }
    loadGroups();
  }, [isAuthenticated, isLoading, user, navigate]);

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p>Loading…</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p style={{ color: "#b91c1c" }}>Authentication error</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  async function createGroup(e) {
    e.preventDefault();
    try {
      const newGroup = await api.post("/groups", { name, currency });
      setGroups([newGroup, ...groups]); // update UI instantly
      setName("");
      setCurrency("USD");
    } catch (err) {
      console.error("Error creating group:", err);
      alert("Failed to create group.");
    }
  }

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div className="simple-dashboard">
      <section className="card">
        <h1 className="simple-dashboard__title">Dashboard</h1>
        <form className="simple-dashboard__form" onSubmit={createGroup}>
          <h3>Create a New Group</h3>
          <div className="simple-dashboard__fields">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Group name"
              required
              className="input"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="select"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="INR">INR</option>
            </select>
            <button type="submit" className="btn btn-primary">
              Add Group
            </button>
          </div>
        </form>

        <div className="simple-dashboard__list">
          <h2>My Groups</h2>
          {groups.length === 0 ? (
            <p className="muted">No groups yet. Try creating one!</p>
          ) : (
            <ul>
              {groups.map((g) => (
                <li key={g.id}>
                  <strong>{g.name}</strong> — Currency: {g.currency} | Paid: $
                  {(g.paid_cents / 100).toFixed(2)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
