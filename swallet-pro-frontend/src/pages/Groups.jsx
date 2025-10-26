import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { accountsAPI, groupsAPI } from "../api";

const defaultForm = {
  name: "",
  purpose: "",
  currency: "USD",
  base_account_id: "",
  contribution_amount: "",
  auto_pay_day: "",
  approval_threshold: 1,
  spending_limit: "",
};

const defaultInvite = { email: "", role: "member" };

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

const formatCurrency = (cents = 0, currency = "USD") =>
  new Intl.NumberFormat("en", { style: "currency", currency }).format((cents || 0) / 100);

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [invites, setInvites] = useState([defaultInvite]);
  const [search, setSearch] = useState("");
  const nav = useNavigate();

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [groupRes, accountRes] = await Promise.all([
        groupsAPI.getAll(),
        accountsAPI.list(),
      ]);
      setGroups(groupRes);
      setAccounts(accountRes.accounts || []);
    } catch (err) {
      console.error("Failed to load groups", err);
      setError("Unable to load groups. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredGroups = useMemo(() => {
    if (!search) return groups;
    const q = search.toLowerCase();
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.purpose || "").toLowerCase().includes(q)
    );
  }, [groups, search]);

  function updateInvite(index, key, value) {
    setInvites((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  function addInviteRow() {
    setInvites((prev) => [...prev, defaultInvite]);
  }

  async function createGroup(e) {
    e.preventDefault();
    setError("");
    try {
      await groupsAPI.create({
        ...form,
        auto_pay_day: form.auto_pay_day ? Number(form.auto_pay_day) : null,
        approval_threshold: Number(form.approval_threshold) || 1,
        spending_limit: form.spending_limit,
        contribution_amount: form.contribution_amount,
        members: invites.filter((invite) => invite.email.trim().length > 0),
      });
      setForm(defaultForm);
      setInvites([defaultInvite]);
      setShowNew(false);
      await loadData();
    } catch (err) {
      console.error("Failed to create group", err);
      setError("Unable to create group. Please verify the form.");
    }
  }

  return (
    <div className="page-stack">
      <section className="card">
        <div className="page-header-sm">
          <div>
            <p className="eyebrow">Groups</p>
            <h2 style={{ margin: 0 }}>Shared spaces</h2>
            <p className="muted">
              Organize trips, households, or side projects. Everything stays in sync.
            </p>
          </div>
          <div className="header-actions">
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>
              + New group
            </button>
          </div>
        </div>

        <div className="form-field" style={{ marginTop: "1rem" }}>
          <input
            className="input"
            placeholder="Search groups…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {error && <p style={{ color: "#f87171" }}>{error}</p>}

        {loading ? (
          <p className="muted" style={{ marginTop: "1.5rem" }}>
            Loading groups…
          </p>
        ) : filteredGroups.length === 0 ? (
          <p className="muted" style={{ marginTop: "1.5rem" }}>
            No groups found.
          </p>
        ) : (
          <div className="group-grid" style={{ marginTop: "1.5rem" }}>
            {filteredGroups.map((g) => (
              <div
                key={g.id}
                className="group-card group-card--link"
                onClick={() => nav(`/groups/${g.id}`)}
              >
                <div>
                  <strong>{g.name}</strong>
                  <p className="muted">{g.purpose || "No purpose set"}</p>
                </div>
                <div className="group-card__value">
                  <span>Balance</span>
                  <strong>{formatCurrency(g.balance_cents, g.currency)}</strong>
                </div>
                <div className="group-card__meta">
                  <span>{g.member_count} members</span>
                  <span>
                    Next due:{" "}
                    {g.next_due_on ? new Date(g.next_due_on).toLocaleDateString() : "—"}
                  </span>
                  <span>Status: {g.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showNew && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-card" onSubmit={createGroup}>
            <h3 style={{ margin: 0 }}>Create group</h3>
            <div className="form-field">
              <span>Name</span>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="form-field">
              <span>Purpose</span>
              <input
                className="input"
                value={form.purpose}
                onChange={(e) => setForm((prev) => ({ ...prev, purpose: e.target.value }))}
                placeholder="Shared rent, project, etc."
              />
            </div>
            <div className="form-field">
              <span>Currency</span>
              <select
                className="select"
                value={form.currency}
                onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="INR">INR</option>
              </select>
            </div>
            <div className="form-field">
              <span>Base account</span>
              <select
                className="select"
                value={form.base_account_id}
                onChange={(e) => setForm((prev) => ({ ...prev, base_account_id: e.target.value }))}
              >
                <option value="">Select…</option>
                {accounts.map((acct) => (
                  <option key={acct.id} value={acct.id}>
                    {acct.institution_name} (•••• {acct.account_number_last4})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-grid" style={{ marginTop: "1rem" }}>
              <label className="form-field">
                <span>Contribution amount</span>
                <input
                  className="input"
                  type="number"
                  placeholder="0.00"
                  value={form.contribution_amount}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, contribution_amount: e.target.value }))
                  }
                />
              </label>
              <label className="form-field">
                <span>Auto-pay day</span>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="28"
                  value={form.auto_pay_day}
                  onChange={(e) => setForm((prev) => ({ ...prev, auto_pay_day: e.target.value }))}
                />
              </label>
              <label className="form-field">
                <span>Approval threshold</span>
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={form.approval_threshold}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, approval_threshold: e.target.value }))
                  }
                />
              </label>
              <label className="form-field">
                <span>Spending limit</span>
                <input
                  className="input"
                  type="number"
                  placeholder="0.00"
                  value={form.spending_limit}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, spending_limit: e.target.value }))
                  }
                />
              </label>
            </div>

            <div style={{ marginTop: "1rem" }}>
              <p style={{ fontWeight: 600 }}>Invite members</p>
              {invites.map((invite, idx) => (
                <div key={`invite-${idx}`} className="form-grid" style={{ marginBottom: "0.5rem" }}>
                  <input
                    className="input"
                    placeholder="email@example.com"
                    value={invite.email}
                    onChange={(e) => updateInvite(idx, "email", e.target.value)}
                  />
                  <select
                    className="select"
                    value={invite.role}
                    onChange={(e) => updateInvite(idx, "role", e.target.value)}
                  >
                    {roleOptions.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={addInviteRow}
                style={{ marginTop: "0.5rem" }}
              >
                + Add another invite
              </button>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowNew(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

