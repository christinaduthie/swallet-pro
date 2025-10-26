import React, { useEffect, useMemo, useState } from "react";
import { accountsAPI } from "../api";
import CryptoJS from "crypto-js";

const ACCOUNT_TYPES = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "credit", label: "Credit Card" },
  { value: "loan", label: "Loan" },
];

const currencyFmt = new Intl.NumberFormat("en", {
  style: "currency",
  currency: "USD",
});

const formatCurrency = (value = 0) => currencyFmt.format((value || 0) / 100);
const generateRandomAmount = () => {
  const dollars = Math.floor(Math.random() * 90) + 10; // 10-99
  const cents = Math.floor(Math.random() * 100);
  return `${dollars.toString().padStart(2, "0")}.${cents.toString().padStart(2, "0")}`;
};
const decryptAccountName = (encrypted) => {
  try {
    const decrypted = CryptoJS.AES.decrypt(encrypted || "", "swallet-basic-key").toString(
      CryptoJS.enc.Utf8
    );
    return decrypted || encrypted;
  } catch {
    return encrypted;
  }
};

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [totals, setTotals] = useState({
    balance_cents: 0,
    available_credit_cents: 0,
    total_debits_cents: 0,
    total_credits_cents: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    institution_name: "",
    account_type: "checking",
    account_number_last4: "",
    routing_number: "",
    balance: "",
    available_credit: "",
    total_debits: "",
    total_credits: "",
    is_default: false,
  });
  const [submitting, setSubmitting] = useState(false);

  async function loadAccounts() {
    setLoading(true);
    setError("");
    try {
      const data = await accountsAPI.list();
      const normalizedAccounts = (data.accounts || []).map((acct) => ({
        ...acct,
        institution_name: decryptAccountName(acct.institution_name),
      }));
      setAccounts(normalizedAccounts);
      setTotals(data.totals || totals);
    } catch (err) {
      console.error("Failed to load accounts", err);
      setError("Unable to load accounts from the API.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const hasCoreFieldsFilled =
        form.institution_name.trim().length > 0 &&
        form.account_type &&
        form.account_number_last4.trim().length === 4 &&
        form.routing_number.trim().length > 0;

      let autoBalance = form.balance;
      let autoCredit = form.available_credit;

      if (hasCoreFieldsFilled) {
        if (!autoBalance) autoBalance = generateRandomAmount();
        if (!autoCredit) autoCredit = generateRandomAmount();
      }

      const payload = {
        ...form,
        balance: autoBalance,
        available_credit: autoCredit,
      };

      if (autoBalance !== form.balance || autoCredit !== form.available_credit) {
        setForm((prev) => ({
          ...prev,
          balance: autoBalance,
          available_credit: autoCredit,
        }));
      }

      // Basic encryption for account name
      const encryptedName = CryptoJS.AES.encrypt(
        payload.institution_name,
        "swallet-basic-key"
      ).toString();
      await accountsAPI.create({ ...payload, institution_name: encryptedName });
      setForm({
        institution_name: "",
        account_type: "checking",
        account_number_last4: "",
        routing_number: "",
        balance: "",
        available_credit: "",
        total_debits: "",
        total_credits: "",
        is_default: false,
      });
      await loadAccounts();
    } catch (err) {
      console.error("Failed to create account", err);
      setError("Unable to create account. Please check the form values.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id) {
    if (!window.confirm("Remove this account?")) return;
    try {
      await accountsAPI.remove(id);
      await loadAccounts();
    } catch (err) {
      console.error("Failed to remove account", err);
      setError("Unable to remove account.");
    }
  }

  async function handleSetDefault(id) {
    try {
      await accountsAPI.setDefault(id);
      await loadAccounts();
    } catch (err) {
      console.error("Failed to set default", err);
      setError("Unable to update default account.");
    }
  }

  const summaryCards = useMemo(
    () => [
      { label: "Global Balance", value: totals.balance_cents },
      { label: "Available Credit", value: totals.available_credit_cents },
      { label: "Total Debits", value: totals.total_debits_cents },
      { label: "Total Credits", value: totals.total_credits_cents },
    ],
    [totals]
  );

  return (
    <div className="page-stack">
      <section className="card">
        <div className="page-header-sm">
          <div>
            <p className="eyebrow">Accounts</p>
            <h2 style={{ margin: 0 }}>Unified balances</h2>
            <p className="muted">
              Aggregate your bank, card, and loan accounts. All totals are read-only.
            </p>
          </div>
        </div>
        {error && <p style={{ color: "#f87171" }}>{error}</p>}
        <div className="stat-grid" style={{ marginTop: "1.5rem" }}>
          {summaryCards.map((card) => (
            <div key={card.label} className="stat-card">
              <h3>{card.label}</h3>
              <strong>{formatCurrency(card.value)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="page-header-sm">
          <div>
            <p className="eyebrow">Add account</p>
            <h2 style={{ margin: 0 }}>Link new source</h2>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Bank Account name*</span>
            <input
              className="input"
              value={form.institution_name}
              onChange={(e) => setForm((prev) => ({ ...prev, institution_name: e.target.value }))}
              required
            />
          </label>
          <label className="form-field">
            <span>Type*</span>
            <select
              className="select"
              value={form.account_type}
              onChange={(e) => setForm((prev) => ({ ...prev, account_type: e.target.value }))}
            >
              {ACCOUNT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Last 4 digits*</span>
            <input
              className="input"
              value={form.account_number_last4}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, account_number_last4: e.target.value }))
              }
              required
              maxLength={4}
            />
          </label>
          <label className="form-field">
            <span>Routing*</span>
            <input
              className="input"
              value={form.routing_number}
              onChange={(e) => setForm((prev) => ({ ...prev, routing_number: e.target.value }))}
            />
          </label>
          <label className="form-field">
            <span>Current balance</span>
            <input
              className="input"
              type="number"
              value={form.balance}
              onChange={(e) => setForm((prev) => ({ ...prev, balance: e.target.value }))}
              placeholder="0.00"
            />
          </label>
          <label className="form-field">
            <span>Available credit</span>
            <input
              className="input"
              type="number"
              value={form.available_credit}
              onChange={(e) => setForm((prev) => ({ ...prev, available_credit: e.target.value }))}
              placeholder="0.00"
            />
          </label>
          <label className="form-field">
            <span>Total debits</span>
            <input
              className="input"
              type="number"
              value={form.total_debits}
              onChange={(e) => setForm((prev) => ({ ...prev, total_debits: e.target.value }))}
              placeholder="0.00"
            />
          </label>
          <label className="form-field">
            <span>Total credits</span>
            <input
              className="input"
              type="number"
              value={form.total_credits}
              onChange={(e) => setForm((prev) => ({ ...prev, total_credits: e.target.value }))}
              placeholder="0.00"
            />
          </label>
          <label className="form-field">
            <span>Default account</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, is_default: e.target.checked }))
                }
              />
              <small className="muted">Used for auto-pay in groups.</small>
            </div>
          </label>
          <div className="form-field align-end">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Adding…" : "Add account"}
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="page-header-sm">
          <div>
            <p className="eyebrow">Linked sources</p>
            <h2 style={{ margin: 0 }}>Your accounts</h2>
          </div>
        </div>
        {loading ? (
          <p className="muted">Loading accounts…</p>
        ) : accounts.length === 0 ? (
          <p className="muted">No accounts yet. Add one above.</p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Type</th>
                  <th>Current balance</th>
                  <th>Available credit</th>
                  <th>Totals (D / C)</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acct) => (
                  <tr key={acct.id}>
                    <td>
                      <strong>{acct.institution_name}</strong>
                      <p className="muted">•••• {acct.account_number_last4}</p>
                    </td>
                    <td style={{ textTransform: "capitalize" }}>{acct.account_type || "—"}</td>
                    <td>{formatCurrency(acct.balance_cents)}</td>
                    <td>{formatCurrency(acct.available_credit_cents)}</td>
                    <td>
                      {formatCurrency(acct.total_debits_cents)} /{" "}
                      {formatCurrency(acct.total_credits_cents)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {acct.is_default ? (
                        <span className="muted">Default</span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => handleSetDefault(acct.id)}
                        >
                          Make default
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => handleRemove(acct.id)}
                        style={{ marginLeft: "0.5rem" }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
