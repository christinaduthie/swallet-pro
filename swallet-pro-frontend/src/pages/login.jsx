import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("http://localhost:4000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Login failed");
      }
      const data = await res.json();
      localStorage.setItem("token", data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <form
        onSubmit={onSubmit}
        style={{
          width: 320,
          display: "grid",
          gap: 12,
          padding: 20,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>Login</h2>

        <label>
          Email
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={onChange}
            placeholder="you@example.com"
            required
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={onChange}
            placeholder="••••••••"
            required
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
        </label>

        {error && (
          <div style={{ color: "#b91c1c", fontSize: 14 }}>{error}</div>
        )}

        <button
          type="submit"
          style={{
            padding: 10,
            borderRadius: 8,
            border: "none",
            background: "#0f172a",
            color: "white",
            cursor: "pointer",
          }}
        >
          Submit
        </button>
      </form>
    </div>
  );
}
