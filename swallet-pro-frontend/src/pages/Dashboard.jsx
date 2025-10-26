import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import Profile from "../components/Profile.jsx";
import LogoutButton from "../components/LogoutButton.jsx";
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
    <div style={{ padding: "2rem", maxWidth: 600, margin: "auto", color: "#fff" }}>
      <h1>Dashboard</h1>

      {/* Group Creation Form */}
      <form
        onSubmit={createGroup}
        style={{
          marginTop: "1rem",
          padding: "1rem",
          background: "#222",
          borderRadius: "8px",
        }}
      >
        <h3>Create a New Group</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Group name"
          required
          style={{
            padding: "0.5rem",
            marginRight: "0.5rem",
            borderRadius: "4px",
            border: "1px solid #555",
            width: "60%",
          }}
        />
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          style={{
            padding: "0.5rem",
            marginRight: "0.5rem",
            borderRadius: "4px",
            border: "1px solid #555",
          }}
        >
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="INR">INR</option>
        </select>
        <button
          type="submit"
          style={{
            padding: "0.5rem 1rem",
            background: "#28a745",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Add Group
        </button>
      </form>

      {/* Group List */}
      <div style={{ marginTop: "2rem" }}>
        <h2>My Groups</h2>
        {groups.length === 0 ? (
          <p>No groups yet. Try creating one!</p>
        ) : (
          <ul>
            {groups.map((g) => (
              <li key={g.id} style={{ marginBottom: "0.5rem" }}>
                <strong>{g.name}</strong> — Currency: {g.currency} | Paid: $
                {(g.paid_cents / 100).toFixed(2)}
              </li>
            ))}
          </ul>
        )}
      </div>
      <LogoutButton />
    </div>
    // <div
    //   style={{
    //     minHeight: "100vh",
    //     display: "grid",
    //     placeItems: "center",
    //     padding: 24,
    //     gap: 24,
    //   }}
    // >
    //   <div style={{ display: "grid", gap: 16, justifyItems: "center" }}>
    //     <h1 style={{ margin: 0 }}>Dashboard</h1>
    //     <Profile />
    //     <LogoutButton />
    //   </div>
    // </div>
  );
}
