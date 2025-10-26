import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  accountsAPI,
  approvalsAPI,
  groupsAPI,
  transactionsAPI,
} from "../api";

const tabs = [
  { key: "ledger", label: "Ledger" },
  { key: "requests", label: "Requests" },
  { key: "approvals", label: "Approvals" },
  { key: "members", label: "Members & Roles" },
  { key: "policies", label: "Rules & Policies" },
  { key: "reports", label: "Reports" },
  { key: "activity", label: "Activity Feed" },
];

const currencyFormatter = (currency = "USD") =>
  new Intl.NumberFormat("en", { style: "currency", currency });

const roleOptions = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

export default function GroupDetail() {
  const { id } = useParams();
  const [group, setGroup] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [requests, setRequests] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [reports, setReports] = useState({ summary: {}, monthly: [] });
  const [activity, setActivity] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [activeTab, setActiveTab] = useState("ledger");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [txForm, setTxForm] = useState({
    amount: "",
    type: "spend",
    description: "",
    due_date: "",
  });
  const [requestForm, setRequestForm] = useState({
    amount: "",
    description: "",
    due_date: "",
  });
  const [memberForm, setMemberForm] = useState({ email: "", role: "member" });
  const [policyForm, setPolicyForm] = useState({
    purpose: "",
    base_account_id: "",
    contribution_amount: "",
    auto_pay_day: "",
    approval_threshold: 1,
    spending_limit: "",
    destination_account_id: "",
  });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [summary, ledgerRes, reqs, approv, reportRes, activityRes, accountsRes] =
          await Promise.all([
            groupsAPI.getById(id),
            groupsAPI.getLedger(id),
            groupsAPI.getRequests(id),
            groupsAPI.getApprovals(id),
            groupsAPI.getReports(id),
            groupsAPI.getActivity(id),
            accountsAPI.list(),
          ]);
        setGroup(summary);
        setLedger(ledgerRes);
        setRequests(reqs);
        setApprovals(approv);
        setReports(reportRes);
        setActivity(activityRes);
        setAccounts(accountsRes.accounts || []);
        setPolicyForm((prev) => ({
          ...prev,
          purpose: summary.purpose || "",
          base_account_id: summary.base_account_id || "",
          destination_account_id: summary.destination_account_id || "",
          contribution_amount: summary.contribution_amount_cents
            ? (summary.contribution_amount_cents / 100).toString()
            : "",
          auto_pay_day: summary.auto_pay_day || "",
          approval_threshold: summary.approval_threshold || 1,
          spending_limit: summary.spending_limit_cents
            ? (summary.spending_limit_cents / 100).toString()
            : "",
        }));
      } catch (err) {
        console.error("Failed to load group detail", err);
        setError("Unable to load group details");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const currency = useMemo(
    () => currencyFormatter(group?.currency || "USD"),
    [group]
  );

  async function handleAddTransaction(e) {
    e.preventDefault();
    try {
      await transactionsAPI.create({
        group_id: id,
        type: txForm.type,
        amount: txForm.amount,
        description: txForm.description,
        due_date: txForm.due_date || undefined,
      });
      setTxForm({ amount: "", type: "spend", description: "", due_date: "" });
      setLedger(await groupsAPI.getLedger(id));
      setRequests(await groupsAPI.getRequests(id));
    } catch (err) {
      console.error("Failed to add transaction", err);
      setError("Unable to add transaction.");
    }
  }

  async function handleRequestSubmit(e) {
    e.preventDefault();
    try {
      await groupsAPI.createRequest(id, {
        amount: requestForm.amount,
        description: requestForm.description,
        due_date: requestForm.due_date,
      });
      setRequestForm({ amount: "", description: "", due_date: "" });
      setRequests(await groupsAPI.getRequests(id));
    } catch (err) {
      console.error("Failed to create request", err);
      setError("Unable to create request.");
    }
  }

  async function handleApprove(txId, decision) {
    try {
      if (decision === "approve") {
        await approvalsAPI.approve(txId);
      } else {
        await approvalsAPI.reject(txId);
      }
      setApprovals(await groupsAPI.getApprovals(id));
      setRequests(await groupsAPI.getRequests(id));
      setLedger(await groupsAPI.getLedger(id));
    } catch (err) {
      console.error("Failed to update approval", err);
      setError("Unable to update approval state.");
    }
  }

  async function handleInviteMember(e) {
    e.preventDefault();
    try {
      await groupsAPI.addMember(id, memberForm);
      setMemberForm({ email: "", role: "member" });
      const refreshed = await groupsAPI.getById(id);
      setGroup(refreshed);
    } catch (err) {
      console.error("Failed to invite member", err);
      setError("Unable to invite member.");
    }
  }

  async function handleRoleChange(memberId, role) {
    try {
      await groupsAPI.updateMember(id, memberId, { role });
      const refreshed = await groupsAPI.getById(id);
      setGroup(refreshed);
    } catch (err) {
      console.error("Failed to update member", err);
      setError("Unable to update member role.");
    }
  }

  async function handleRemoveMember(memberId) {
    if (!window.confirm("Remove this member?")) return;
    try {
      await groupsAPI.removeMember(id, memberId);
      const refreshed = await groupsAPI.getById(id);
      setGroup(refreshed);
    } catch (err) {
      console.error("Failed to remove member", err);
      setError("Unable to remove member.");
    }
  }

  async function handlePolicySubmit(e) {
    e.preventDefault();
    try {
      await groupsAPI.updatePolicies(id, policyForm);
      const refreshed = await groupsAPI.getById(id);
      setGroup(refreshed);
    } catch (err) {
      console.error("Failed to update policies", err);
      setError("Unable to update policies.");
    }
  }

  if (loading) return <p>Loading…</p>;
  if (error) return <p style={{ color: "#f87171" }}>{error}</p>;
  if (!group) return <p>Group not found.</p>;

  const renderLedger = () => (
    <>
      <form className="form-grid" onSubmit={handleAddTransaction}>
        <label className="form-field">
          <span>Amount</span>
          <input
            className="input"
            type="number"
            value={txForm.amount}
            onChange={(e) => setTxForm((prev) => ({ ...prev, amount: e.target.value }))}
            required
            placeholder="0.00"
          />
        </label>
        <label className="form-field">
          <span>Type</span>
          <select
            className="select"
            value={txForm.type}
            onChange={(e) => setTxForm((prev) => ({ ...prev, type: e.target.value }))}
          >
            <option value="spend">Spend</option>
            <option value="collect">Collect</option>
            <option value="reimburse">Reimburse</option>
          </select>
        </label>
        <label className="form-field">
          <span>Due date (optional)</span>
          <input
            className="input"
            type="date"
            value={txForm.due_date}
            onChange={(e) => setTxForm((prev) => ({ ...prev, due_date: e.target.value }))}
          />
        </label>
        <label className="form-field">
          <span>Description</span>
          <input
            className="input"
            value={txForm.description}
            onChange={(e) =>
              setTxForm((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="Dinner at Mercado"
          />
        </label>
        <div className="form-field align-end">
          <button className="btn btn-primary" type="submit">
            Add transaction
          </button>
        </div>
      </form>
      <div className="table-wrapper" style={{ marginTop: "1.5rem" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Description</th>
              <th>Due</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((t) => (
              <tr key={t.id}>
                <td style={{ textTransform: "capitalize" }}>{t.type}</td>
                <td>{t.description || "—"}</td>
                <td>{t.due_date ? new Date(t.due_date).toLocaleDateString() : "—"}</td>
                <td>{t.status}</td>
                <td style={{ textAlign: "right" }}>
                  {currency.format((t.amount_cents || 0) / 100)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderRequests = () => (
    <>
      <form className="form-grid" onSubmit={handleRequestSubmit}>
        <label className="form-field">
          <span>Amount</span>
          <input
            className="input"
            type="number"
            value={requestForm.amount}
            onChange={(e) =>
              setRequestForm((prev) => ({ ...prev, amount: e.target.value }))
            }
            required
            placeholder="0.00"
          />
        </label>
        <label className="form-field">
          <span>Description</span>
          <input
            className="input"
            value={requestForm.description}
            onChange={(e) =>
              setRequestForm((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="Utility share"
          />
        </label>
        <label className="form-field">
          <span>Due date</span>
          <input
            className="input"
            type="date"
            value={requestForm.due_date}
            onChange={(e) =>
              setRequestForm((prev) => ({ ...prev, due_date: e.target.value }))
            }
          />
        </label>
        <div className="form-field align-end">
          <button className="btn btn-primary" type="submit">
            Create request
          </button>
        </div>
      </form>
      <ul className="list" style={{ marginTop: "1rem" }}>
        {requests.map((req) => (
          <li key={req.id} className="list-item transaction-row">
            <div>
              <strong>{req.description || "Untitled request"}</strong>
              <p className="muted">
                Due {req.due_date ? new Date(req.due_date).toLocaleDateString() : "—"}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <strong>{currency.format((req.amount_cents || 0) / 100)}</strong>
              <p className="muted">
                {req.approvals} approved / {req.rejections} rejected
              </p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );

  const renderApprovals = () => (
    <ul className="list">
      {approvals.map((item) => {
        const progress =
          item.approval_threshold > 0
            ? Math.min(
                100,
                Math.round((item.approvals / item.approval_threshold) * 100)
              )
            : 0;
        return (
          <li key={item.id} className="list-item transaction-row">
            <div>
              <strong>{item.description || "Untitled"}</strong>
              <p className="muted">
                Threshold {item.approval_threshold} · {item.status}
              </p>
              <div className="progress">
                <div className="progress__bar" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleApprove(item.id, "approve")}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => handleApprove(item.id, "reject")}
                  style={{ marginLeft: "0.5rem" }}
                >
                  Reject
                </button>
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );

  const renderMembers = () => (
    <>
      <form className="form-grid" onSubmit={handleInviteMember}>
        <label className="form-field">
          <span>Email</span>
          <input
            className="input"
            type="email"
            value={memberForm.email}
            onChange={(e) => setMemberForm((prev) => ({ ...prev, email: e.target.value }))}
            required
          />
        </label>
        <label className="form-field">
          <span>Role</span>
          <select
            className="select"
            value={memberForm.role}
            onChange={(e) => setMemberForm((prev) => ({ ...prev, role: e.target.value }))}
          >
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
        <div className="form-field align-end">
          <button className="btn btn-primary" type="submit">
            Invite
          </button>
        </div>
      </form>

      <div className="table-wrapper" style={{ marginTop: "1rem" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {group.members?.map((member) => (
              <tr key={member.id}>
                <td>
                  <strong>{member.display_name || member.email}</strong>
                  <p className="muted">{member.email}</p>
                </td>
                <td>
                  <select
                    className="select"
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value)}
                  >
                    {roleOptions.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => handleRemoveMember(member.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderPolicies = () => (
    <form className="form-grid" onSubmit={handlePolicySubmit}>
      <label className="form-field">
        <span>Purpose</span>
        <input
          className="input"
          value={policyForm.purpose}
          onChange={(e) => setPolicyForm((prev) => ({ ...prev, purpose: e.target.value }))}
        />
      </label>
      <label className="form-field">
        <span>Base account</span>
        <select
          className="select"
          value={policyForm.base_account_id}
          onChange={(e) =>
            setPolicyForm((prev) => ({ ...prev, base_account_id: e.target.value }))
          }
        >
          <option value="">Select…</option>
          {accounts.map((acct) => (
            <option key={acct.id} value={acct.id}>
              {acct.institution_name} (•••• {acct.account_number_last4})
            </option>
          ))}
        </select>
      </label>
      <label className="form-field">
        <span>Destination account</span>
        <select
          className="select"
          value={policyForm.destination_account_id}
          onChange={(e) =>
            setPolicyForm((prev) => ({
              ...prev,
              destination_account_id: e.target.value,
            }))
          }
        >
          <option value="">Select…</option>
          {accounts.map((acct) => (
            <option key={acct.id} value={acct.id}>
              {acct.institution_name} (•••• {acct.account_number_last4})
            </option>
          ))}
        </select>
      </label>
      <label className="form-field">
        <span>Contribution amount</span>
        <input
          className="input"
          type="number"
          value={policyForm.contribution_amount}
          onChange={(e) =>
            setPolicyForm((prev) => ({
              ...prev,
              contribution_amount: e.target.value,
            }))
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
          value={policyForm.auto_pay_day}
          onChange={(e) =>
            setPolicyForm((prev) => ({ ...prev, auto_pay_day: e.target.value }))
          }
        />
      </label>
      <label className="form-field">
        <span>Approval threshold</span>
        <input
          className="input"
          type="number"
          min="1"
          value={policyForm.approval_threshold}
          onChange={(e) =>
            setPolicyForm((prev) => ({
              ...prev,
              approval_threshold: e.target.value,
            }))
          }
        />
      </label>
      <label className="form-field">
        <span>Spending limit</span>
        <input
          className="input"
          type="number"
          value={policyForm.spending_limit}
          onChange={(e) =>
            setPolicyForm((prev) => ({
              ...prev,
              spending_limit: e.target.value,
            }))
          }
        />
      </label>
      <div className="form-field align-end">
        <button type="submit" className="btn btn-primary">
          Save policies
        </button>
      </div>
    </form>
  );

  const renderReports = () => (
    <>
      <div className="stat-grid" style={{ marginBottom: "1rem" }}>
        <div className="stat-card">
          <h3>Collected</h3>
          <strong>{currency.format((reports.summary?.collected_cents || 0) / 100)}</strong>
        </div>
        <div className="stat-card">
          <h3>Spent</h3>
          <strong>{currency.format((reports.summary?.spent_cents || 0) / 100)}</strong>
        </div>
        <div className="stat-card">
          <h3>Pending</h3>
          <strong>{currency.format((reports.summary?.pending_cents || 0) / 100)}</strong>
        </div>
      </div>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Collected</th>
              <th>Spent</th>
              <th>Reimbursed</th>
            </tr>
          </thead>
          <tbody>
            {reports.monthly.map((row) => (
              <tr key={row.month}>
                <td>{new Date(row.month).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</td>
                <td>{currency.format((row.collect_cents || 0) / 100)}</td>
                <td>{currency.format((row.spend_cents || 0) / 100)}</td>
                <td>{currency.format((row.reimburse_cents || 0) / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderActivity = () => (
    <ul className="list">
      {activity.map((item) => (
        <li key={item.key} className="list-item transaction-row">
          <div>
            <strong style={{ textTransform: "capitalize" }}>{item.kind}</strong>
            <p className="muted">{item.body}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <strong>{new Date(item.occurred_at).toLocaleString()}</strong>
            <p className="muted">{item.actor}</p>
          </div>
        </li>
      ))}
    </ul>
  );

  const currentTab = () => {
    switch (activeTab) {
      case "ledger":
        return renderLedger();
      case "requests":
        return renderRequests();
      case "approvals":
        return renderApprovals();
      case "members":
        return renderMembers();
      case "policies":
        return renderPolicies();
      case "reports":
        return renderReports();
      case "activity":
        return renderActivity();
      default:
        return null;
    }
  };

  return (
    <div className="page-stack">
      <section className="card">
        <p className="eyebrow">Group</p>
        <h2 style={{ margin: 0 }}>{group.name}</h2>
        <div className="stat-grid" style={{ marginTop: "1rem" }}>
          <div className="stat-card">
            <h3>Members</h3>
            <strong>{group.stats?.member_count || 0}</strong>
            <p className="muted">Active collaborators</p>
          </div>
          <div className="stat-card">
            <h3>Total paid</h3>
            <strong>{currency.format((group.stats?.paid_total_cents || 0) / 100)}</strong>
            <p className="muted">Synced from the ledger.</p>
          </div>
          <div className="stat-card">
            <h3>Outstanding</h3>
            <strong>{currency.format((group.stats?.outstanding_cents || 0) / 100)}</strong>
            <p className="muted">
              Next due {group.stats?.next_due_date ? new Date(group.stats.next_due_date).toLocaleDateString() : "—"}
            </p>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`tab ${activeTab === tab.key ? "is-active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: "1rem" }}>{currentTab()}</div>
      </section>
    </div>
  );
}

