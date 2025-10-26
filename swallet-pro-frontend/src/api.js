// src/api.js
// Central API helper for Swallet Pro frontend

// Normalize the base URL from .env or fallback
let API_BASE = import.meta?.env?.VITE_API_URL || "http://localhost:4000";
console.log("🌐 API_BASE:", API_BASE);

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

/* ---------- Convenience Wrappers (Frontend → Backend API) ---------- */

// 🏠 Dashboard
export const dashboardAPI = {
  getSummary: () => api.get("/groups"), // recent balances / active groups
};

// 👥 Groups
export const groupsAPI = {
  getAll: () => api.get("/groups"),
  getById: (id) => api.get(`/groups/${id}`),
  create: (data) => api.post("/groups", data),
  addMember: (groupId, email, role = "member") =>
    api.post(`/groups/${groupId}/members`, { email, role }),
  getLedger: (groupId) => api.get(`/groups/${groupId}/ledger`),
};

// 💸 Transactions
export const transactionsAPI = {
  create: (data) => api.post("/transactions", data),
  getComments: (id) => api.get(`/transactions/${id}/comments`),
  addComment: (id, body) => api.post(`/transactions/${id}/comments`, { body }),
};

// ✅ Approvals
export const approvalsAPI = {
  approve: (txId) => api.post(`/approvals/${txId}`, { decision: "approve" }),
  reject: (txId) => api.post(`/approvals/${txId}`, { decision: "reject" }),
};

// 💳 Accounts
export const accountsAPI = {
  getByUser: (userId) => api.get(`/accounts/${userId}`),
};

// 🧑‍🤝‍🧑 Contacts
export const contactsAPI = {
  getAll: () => api.get("/contacts"),
  add: (contact_name, contact_email) =>
    api.post("/contacts", { contact_name, contact_email }),
};

// 🔔 Notifications
export const notificationsAPI = {
  getAll: () => api.get("/notifications"),
};

// ⚙️ Settings
export const settingsAPI = {
  get: () => api.get("/settings"),
  update: (data) => api.put("/settings", data),
};

// 👤 Auth (Signup/Login/Health)
export const authAPI = {
  signup: (email, password, display_name) =>
    api.post("/signup", { email, password, display_name }),
  login: (email, password) => api.post("/login", { email, password }),
  health: () => api.get("/health"),
};
