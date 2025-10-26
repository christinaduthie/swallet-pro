import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function MyProfile() {
  const { user } = useAuth0();

  if (!user) {
    return (
      <div className="page-stack">
        <section className="card">
          <p className="muted">Profile details load once you are signed in.</p>
        </section>
      </div>
    );
  }

  const profilePairs = [
    { label: "Email", value: user.email },
    { label: "Nickname", value: user.nickname },
    { label: "Locale", value: user.locale },
    { label: "Last login", value: user.updated_at },
  ].filter((item) => item.value);

  return (
    <div className="page-stack">
      <section className="card profile-card">
        <div className="profile-card__main">
          {user.picture && (
            <img src={user.picture} alt={user.name} className="profile-card__avatar" />
          )}
          <div>
            <p className="eyebrow">My Profile</p>
            <h2 style={{ margin: 0 }}>{user.name || "Member"}</h2>
            <p className="muted">Switch between workspaces, manage account security, or update notifications.</p>
          </div>
        </div>
        <div className="profile-card__grid">
          {profilePairs.map((item) => (
            <div key={item.label} className="profile-field">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
