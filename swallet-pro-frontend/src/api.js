// src/api.js
// Central API helper for Swallet Pro frontend

// Normalize the base URL from .env or fallback
let API_BASE = import.meta?.env?.VITE_API_URL || "http://localhost:4000";

// Ensure only one '/api' prefix — not double or missing
if (!API_BASE.endsWith("/api")) {
  API_BASE = API_BASE.replace(/\/$/, "") + "/api";
}

// Helper to safely prepend paths
const withBase = (path) => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
};

// Core API wrapper
export const api = {
  async get(path) {
    const token = localStorage.getItem("token") || "fake|user@example.com";
    const res = await fetch(withBase(path), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async post(path, body) {
    const token = localStorage.getItem("token") || "fake|user@example.com";
    const res = await fetch(withBase(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async put(path, body) {
    const token = localStorage.getItem("token") || "fake|user@example.com";
    const res = await fetch(withBase(path), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async del(path) {
    const token = localStorage.getItem("token") || "fake|user@example.com";
    const res = await fetch(withBase(path), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
