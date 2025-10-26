import React, { useEffect, useState } from "react";
import { contactsAPI } from "../api";

const defaultForm = {
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  can_send: false,
  can_receive: true,
  zelle_handle: "",
  venmo_handle: "",
  notes: "",
};

export default function People() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(defaultForm);
  const [selected, setSelected] = useState(null);
  const [insights, setInsights] = useState(null);

  async function fetchContacts(query = "") {
    setLoading(true);
    setError("");
    try {
      const data = await contactsAPI.getAll(query);
      setContacts(data);
    } catch (err) {
      console.error("Failed to load contacts", err);
      setError("Unable to load contacts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchContacts();
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => fetchContacts(search), 300);
    return () => clearTimeout(handle);
  }, [search]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await contactsAPI.add(form.contact_name, form.contact_email || undefined);
      if (form.contact_phone || form.notes || form.zelle_handle || form.venmo_handle || form.can_send !== defaultForm.can_send || form.can_receive !== defaultForm.can_receive) {
        const latest = await contactsAPI.getAll();
        const newContact = latest.find(
          (c) =>
            c.contact_name === form.contact_name &&
            c.contact_email === form.contact_email
        );
        if (newContact) {
          await contactsAPI.update(newContact.id, {
            contact_phone: form.contact_phone || undefined,
            can_send: form.can_send,
            can_receive: form.can_receive,
            zelle_handle: form.zelle_handle || undefined,
            venmo_handle: form.venmo_handle || undefined,
            notes: form.notes || undefined,
          });
        }
      }
      setForm(defaultForm);
      fetchContacts(search);
    } catch (err) {
      console.error("Failed to add contact", err);
      setError("Unable to add contact.");
    }
  }

  async function handleUpdate(id, payload) {
    try {
      await contactsAPI.update(id, payload);
      fetchContacts(search);
    } catch (err) {
      console.error("Failed to update contact", err);
      setError("Unable to update contact.");
    }
  }

  async function handleRemove(id) {
    if (!window.confirm("Remove this contact?")) return;
    try {
      await contactsAPI.remove(id);
      if (selected?.id === id) {
        setSelected(null);
        setInsights(null);
      }
      fetchContacts(search);
    } catch (err) {
      console.error("Failed to remove contact", err);
      setError("Unable to remove contact.");
    }
  }

  async function loadInsights(contact) {
    setSelected(contact);
    try {
      const data = await contactsAPI.insights(contact.id);
      setInsights(data);
    } catch (err) {
      console.error("Failed to load insights", err);
      setInsights(null);
    }
  }

  return (
    <div className="page-stack">
      <section className="card">
        <div className="page-header-sm">
          <div>
            <p className="eyebrow">People</p>
            <h2 style={{ margin: 0 }}>Trusted contacts</h2>
            <p className="muted">
              Save handles, toggles, and recent interactions for faster collaboration.
            </p>
          </div>
        </div>
        {error && <p style={{ color: "#f87171" }}>{error}</p>}
        <div className="form-field" style={{ marginTop: "1rem" }}>
          <input
            className="input"
            placeholder="Search contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Add contact</p>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Name</span>
            <input
              className="input"
              value={form.contact_name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, contact_name: e.target.value }))
              }
              required
            />
          </label>
          <label className="form-field">
            <span>Email</span>
            <input
              className="input"
              type="email"
              value={form.contact_email}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, contact_email: e.target.value }))
              }
            />
          </label>
          <label className="form-field">
            <span>Phone</span>
            <input
              className="input"
              value={form.contact_phone}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, contact_phone: e.target.value }))
              }
            />
          </label>
          <label className="form-field">
            <span>Can send money</span>
            <input
              type="checkbox"
              checked={form.can_send}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, can_send: e.target.checked }))
              }
            />
          </label>
          <label className="form-field">
            <span>Can request money</span>
            <input
              type="checkbox"
              checked={form.can_receive}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, can_receive: e.target.checked }))
              }
            />
          </label>
          <label className="form-field">
            <span>Zelle handle</span>
            <input
              className="input"
              value={form.zelle_handle}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, zelle_handle: e.target.value }))
              }
            />
          </label>
          <label className="form-field">
            <span>Venmo handle</span>
            <input
              className="input"
              value={form.venmo_handle}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, venmo_handle: e.target.value }))
              }
            />
          </label>
          <label className="form-field">
            <span>Notes</span>
            <textarea
              className="textarea"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </label>
          <div className="form-field align-end">
            <button type="submit" className="btn btn-primary">
              Save contact
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="page-header-sm">
          <div>
            <p className="eyebrow">Directory</p>
            <h2 style={{ margin: 0 }}>Contacts</h2>
          </div>
        </div>
        {loading ? (
          <p className="muted">Loading contacts…</p>
        ) : contacts.length === 0 ? (
          <p className="muted">No contacts yet.</p>
        ) : (
          <div className="table-wrapper" style={{ marginTop: "1rem" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Permissions</th>
                  <th>Handles</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td>
                      <strong>{contact.contact_name}</strong>
                      <p className="muted">{contact.contact_email || contact.contact_phone || "—"}</p>
                    </td>
                    <td>
                      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={contact.can_send}
                          onChange={(e) =>
                            handleUpdate(contact.id, { can_send: e.target.checked })
                          }
                        />
                        <span className="muted">Can send</span>
                      </label>
                      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={contact.can_receive}
                          onChange={(e) =>
                            handleUpdate(contact.id, { can_receive: e.target.checked })
                          }
                        />
                        <span className="muted">Can request</span>
                      </label>
                    </td>
                    <td>
                      <p className="muted">
                        {contact.zelle_handle || contact.venmo_handle
                          ? `${contact.zelle_handle || ""} ${contact.venmo_handle || ""}`.trim()
                          : "—"}
                      </p>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => loadInsights(contact)}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => handleRemove(contact.id)}
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

      {selected && (
        <section className="card">
          <div className="page-header-sm">
            <div>
              <p className="eyebrow">Insights</p>
              <h2 style={{ margin: 0 }}>{selected.contact_name}</h2>
              <p className="muted">
                Shared groups and recent interactions tailored to this contact.
              </p>
            </div>
          </div>
          {insights ? (
            <div className="stat-grid" style={{ marginTop: "1rem" }}>
              <div className="stat-card">
                <h3>Shared groups</h3>
                <ul className="muted" style={{ paddingLeft: "1rem" }}>
                  {insights.shared_groups?.length
                    ? insights.shared_groups.map((g) => <li key={g.id}>{g.name}</li>)
                    : "None"}
                </ul>
              </div>
              <div className="stat-card">
                <h3>Recent transactions</h3>
                <ul className="muted" style={{ paddingLeft: "1rem" }}>
                  {insights.recent_transactions?.length
                    ? insights.recent_transactions.map((tx) => (
                        <li key={tx.id}>
                          {tx.description || "Untitled"} – {new Date(tx.created_at).toLocaleDateString()}
                        </li>
                      ))
                    : "None"}
                </ul>
              </div>
            </div>
          ) : (
            <p className="muted" style={{ marginTop: "1rem" }}>
              Loading insights…
            </p>
          )}
        </section>
      )}
    </div>
  );
}
