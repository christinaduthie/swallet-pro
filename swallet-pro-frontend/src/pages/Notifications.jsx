import React, { useState } from "react";

const notificationDefinitions = [
  { key: "settle", title: "Settlement updates", description: "Ping me when a member pays or owes more than $100.", channel: "Push" },
  { key: "groupChanges", title: "Group changes", description: "Alert me when someone edits the group ledger.", channel: "Email" },
  { key: "weeklyDigest", title: "Weekly digest", description: "Summary landing in your inbox every Monday.", channel: "Email" },
];

export default function Notifications() {
  const [preferences, setPreferences] = useState({
    settle: true,
    groupChanges: true,
    weeklyDigest: false,
  });

  function toggle(key) {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="page-stack">
      <section className="card">
        <div className="page-header-sm">
          <div>
            <p className="eyebrow">Signals</p>
            <h2 style={{ margin: 0 }}>Notifications</h2>
            <p className="muted">Only the important stuff. Switch channels and cadence anytime.</p>
          </div>
          <button className="btn btn-ghost">Pause all</button>
        </div>
        <div className="settings-list" style={{ marginTop: "1.5rem" }}>
          {notificationDefinitions.map((item) => (
            <div key={item.key} className="setting-row">
              <div>
                <strong>{item.title}</strong>
                <p className="muted">{item.description}</p>
                <span className="pill gray">{item.channel}</span>
              </div>
              <label className={`switch ${preferences[item.key] ? "is-on" : ""}`}>
                <input
                  type="checkbox"
                  checked={preferences[item.key]}
                  onChange={() => toggle(item.key)}
                />
                <span className="switch-handle" />
              </label>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
