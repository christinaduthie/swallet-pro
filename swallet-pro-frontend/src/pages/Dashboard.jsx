import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { dashboardAPI } from "../api";

const currencyFormatter = new Intl.NumberFormat("en", {
  style: "currency",
  currency: "USD",
});

const formatCurrency = (cents = 0) => currencyFormatter.format((cents || 0) / 100);

export default function Dashboard() {
  const [summary, setSummary] = useState({
    accounts: [],
    totals: {
      balance_cents: 0,
      available_credit_cents: 0,
      total_debits_cents: 0,
      total_credits_cents: 0,
    },
    upcoming: [],
    recent: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showBalance, setShowBalance] = useState(false);

  const navigate = useNavigate();
  const { isAuthenticated, isLoading, error: authError, user } = useAuth0();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      localStorage.removeItem("token");
      navigate("/", { replace: true });
      return;
    }
    if (user?.email) {
      localStorage.setItem("token", `fake|${user.email}`);
    }

    (async () => {
      try {
        const data = await dashboardAPI.getSummary();
        setSummary({
          accounts: data.accounts || [],
          totals: data.totals || summary.totals,
          upcoming: data.upcoming || [],
          recent: data.recent || [],
        });
      } catch (err) {
        console.error("Failed to load dashboard summary", err);
        setError("Unable to reach the dashboard API.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated, isLoading, navigate, user]);

  const maskedValue = (value) => (showBalance ? formatCurrency(value) : "••••••");

  const totalCards = useMemo(
    () => [
      { label: "Global Balance", value: summary.totals.balance_cents },
      { label: "Available Credit", value: summary.totals.available_credit_cents },
      { label: "Total Debits", value: summary.totals.total_debits_cents },
      { label: "Total Credits", value: summary.totals.total_credits_cents },
    ],
    [summary.totals]
  );

  if (isLoading || loading) {
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
  if (error) return <p style={{ color: "#b91c1c" }}>{error}</p>;

  return (
    <div className="page-stack">
      <section className="card">
        <div className="page-header-sm">
          <div>
            <p className="eyebrow">Secure Overview</p>
            <h2 style={{ margin: 0 }}>Check balances at a glance</h2>
            <p className="muted">Toggle to reveal totals across every linked source.</p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowBalance((s) => !s)}
          >
            {showBalance ? "Hide amounts" : "Show amounts"}
          </button>
        </div>

        <div className="stat-grid" style={{ marginTop: "1.5rem" }}>
          {totalCards.map((card) => (
            <div key={card.label} className="stat-card">
              <h3>{card.label}</h3>
              <strong>{maskedValue(card.value)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="page-header-sm">
          <div>
            <p className="eyebrow">Quick Actions</p>
            <h2 style={{ margin: 0 }}>Move faster with shortcuts</h2>
          </div>
        </div>
        <div className="quick-links">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate("/groups")}
          >
            Create Group
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate("/groups")}
          >
            New Request
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate("/accounts")}
          >
            Add Account
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate("/people")}
          >
            Invite Contact
          </button>
        </div>
      </section>

      <section className="card">
        <div className="page-header-sm">
          <div>
            <p className="eyebrow">Upcoming</p>
            <h2 style={{ margin: 0 }}>Payments queue</h2>
          </div>
        </div>
        {summary.upcoming.length === 0 ? (
          <p className="muted">You&apos;re all clear. No payments are due.</p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Description</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {summary.upcoming.map((payment) => {
                  const dueDate = payment.due_on || payment.due_date || payment.created_at;
                  return (
                    <tr key={payment.id}>
                      <td>{payment.group_name}</td>
                      <td>{payment.description || "—"}</td>
                      <td>{dueDate ? new Date(dueDate).toLocaleDateString() : "—"}</td>
                      <td>{payment.status}</td>
                      <td style={{ textAlign: "right" }}>{formatCurrency(payment.amount_cents)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="page-header-sm">
          <div>
            <p className="eyebrow">Recent</p>
            <h2 style={{ margin: 0 }}>Latest activity</h2>
          </div>
        </div>

        {summary.recent.length === 0 ? (
          <p className="muted">No activity just yet.</p>
        ) : (
          <ul className="list" style={{ marginTop: "1rem" }}>
            {summary.recent.map((tx) => (
              <li key={tx.id} className="list-item transaction-row">
                <div>
                  <strong>{tx.group_name}</strong>
                  <p className="muted">{tx.description || tx.type}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong>{formatCurrency(tx.amount_cents)}</strong>
                  <p className="muted">{new Date(tx.created_at).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

