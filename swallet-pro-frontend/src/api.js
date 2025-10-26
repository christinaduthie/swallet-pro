// src/api.js
// Central API helper for Swallet Pro frontend

const envURL =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL
    : "http://localhost:4000";

const API_BASE = `${envURL}/api`;


export const api = {
  async get(path) {
    const token = localStorage.getItem("token") || "fake|user@example.com";
    const res = await fetch(`${API_BASE}${path.startsWith("/") ? path : `/${path}`}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async post(path, body) {
    const token = localStorage.getItem("token") || "fake|user@example.com";
    const res = await fetch(`${API_BASE}${path.startsWith("/") ? path : `/${path}`}`, {
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
    const res = await fetch(`${API_BASE}${path}`, {
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
    const res = await fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};