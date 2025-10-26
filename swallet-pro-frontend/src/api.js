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
  getSummary: () => api.get("/dashboard"),
};

// 👥 Groups
export const groupsAPI = {
  getAll: () => api.get("/groups"),
  getById: (id) => api.get(`/groups/${id}`),
  create: (data) => api.post("/groups", data),
  updatePolicies: (id, payload) =>
    api.put(`/groups/${id}/policies`, payload),
  addMember: (groupId, payload) =>
    api.post(`/groups/${groupId}/members`, payload),
  updateMember: (groupId, memberId, payload) =>
    api.put(`/groups/${groupId}/members/${memberId}`, payload),
  removeMember: (groupId, memberId) =>
    api.del(`/groups/${groupId}/members/${memberId}`),
  getLedger: (groupId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    const suffix = query ? `?${query}` : "";
    return api.get(`/groups/${groupId}/ledger${suffix}`);
  },
  getRequests: (groupId) => api.get(`/groups/${groupId}/requests`),
  getApprovals: (groupId) => api.get(`/groups/${groupId}/approvals`),
  getActivity: (groupId) => api.get(`/groups/${groupId}/activity`),
  getReports: (groupId) => api.get(`/groups/${groupId}/reports`),
  createRequest: (groupId, payload) =>
    api.post(`/groups/${groupId}/requests`, payload),
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
  list: () => api.get("/accounts"),
  create: (payload) => api.post("/accounts", payload),
  update: (id, payload) => api.put(`/accounts/${id}`, payload),
  remove: (id) => api.del(`/accounts/${id}`),
  setDefault: (id) => api.post(`/accounts/${id}/default`),
};

// 🧑‍🤝‍🧑 Contacts
export const contactsAPI = {
  getAll: (search) => {
    if (search) {
      return api.get(`/contacts?search=${encodeURIComponent(search)}`);
    }
    return api.get("/contacts");
  },
  add: (contact_name, contact_email) =>
    api.post("/contacts", { contact_name, contact_email }),
  update: (id, payload) => api.put(`/contacts/${id}`, payload),
  remove: (id) => api.del(`/contacts/${id}`),
  insights: (id) => api.get(`/contacts/${id}/insights`),
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
