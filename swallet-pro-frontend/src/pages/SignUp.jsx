import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

export default function SignUp() {
  const nav = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", confirm: "", name: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          display_name: form.name || undefined
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Sign up failed");
      }
      const data = await res.json();
      localStorage.setItem("token", data.token); // "fake|email"
      nav("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <form
        onSubmit={onSubmit}
        style={{ width: 360, display: "grid", gap: 12, padding: 20, border: "1px solid #e5e7eb", borderRadius: 12 }}
      >
        <h2 style={{ margin: 0 }}>Create your account</h2>

        <label>
          Name (optional)
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={onChange}
            placeholder="Your name"
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
        </label>

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

        <label>
          Confirm Password
          <input
            type="password"
            name="confirm"
            value={form.confirm}
            onChange={onChange}
            placeholder="••••••••"
            required
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
        </label>

        {error && <div style={{ color: "#b91c1c", fontSize: 14 }}>{error}</div>}

        <button
          type="submit"
          disabled={busy}
          style={{
            padding: 10, borderRadius: 8, border: "none",
            background: busy ? "#64748b" : "#0f172a", color: "white", cursor: "pointer"
          }}
        >
          {busy ? "Creating..." : "Create account"}
        </button>

        <div style={{ fontSize: 14, textAlign: "center", marginTop: 6 }}>
          Already have an account? <Link to="/">Log in</Link>
        </div>
      </form>
    </div>
  );
}
