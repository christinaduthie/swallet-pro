import React, { useState } from "react";

const settingDefinitions = [
  {
    key: "autoSettle",
    title: "Auto-settle reminders",
    description: "Send nudges 48 hours before a due date so nobody forgets to close out balances.",
  },
  {
    key: "currencyLock",
    title: "Lock currency per group",
    description: "Prevent accidental conversions when groups have multiple contributors.",
  },
  {
    key: "analytics",
    title: "Advanced analytics",
    description: "Include spending insights and forecasting inside dashboards.",
  },
];

export default function Settings() {
  const [settings, setSettings] = useState({
    autoSettle: true,
    currencyLock: false,
    analytics: true,
  });

  function toggle(key) {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="page-stack">
      <section className="card">
        <p className="eyebrow">Preferences</p>
        <h2 style={{ margin: "0 0 1rem" }}>Workspace settings</h2>
        <div className="settings-list">
          {settingDefinitions.map((setting) => (
            <div key={setting.key} className="setting-row">
              <div>
                <strong>{setting.title}</strong>
                <p className="muted">{setting.description}</p>
              </div>
              <label className={`switch ${settings[setting.key] ? "is-on" : ""}`}>
                <input
                  type="checkbox"
                  checked={settings[setting.key]}
                  onChange={() => toggle(setting.key)}
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
