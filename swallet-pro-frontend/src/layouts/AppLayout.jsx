import React from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import LogoutButton from "../components/LogoutButton.jsx";

const primaryNav = [
  { label: "Dashboard", to: "/dashboard", icon: "grid" },
  { label: "Accounts", to: "/accounts", icon: "wallet" },
  { label: "Groups", to: "/groups", icon: "users" },
  { label: "People", to: "/people", icon: "person" },
];

const quickLinks = [
  {
    label: "My Profile",
    to: "/profile",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    label: "Settings",
    to: "/settings",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M19.14 12.94a7.09 7.09 0 0 0 .05-.94 7.09 7.09 0 0 0-.05-.94l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a6.85 6.85 0 0 0-1.63-.94l-.38-2.65A.5.5 0 0 0 13.78 3h-3.56a.5.5 0 0 0-.49.42l-.38 2.65a6.85 6.85 0 0 0-1.63.94l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64L4.86 11.06a7.09 7.09 0 0 0-.05.94 7.09 7.09 0 0 0 .05.94l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .6.22l2.49-1a6.85 6.85 0 0 0 1.63.94l.38 2.65a.5.5 0 0 0 .49.42h3.56a.5.5 0 0 0 .49-.42l.38-2.65a6.85 6.85 0 0 0 1.63-.94l2.49 1a.5.5 0 0 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64ZM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    label: "Notifications",
    to: "/notifications",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm6.36-6a2 2 0 0 0 .64-1.46V11a7 7 0 0 0-5-6.71V3a1.5 1.5 0 0 0-3 0v1.29A7 7 0 0 0 6 11v3.57A2 2 0 0 0 6.64 16L5 18v1h14v-1Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    label: "FAQ",
    to: "/faq",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M11 18h2v-2h-2Zm1-16a9 9 0 0 0-9 9h2a7 7 0 1 1 7 7v3h2v-3a9 9 0 0 0-2-18Zm0 4a5 5 0 0 0-5 5h2a3 3 0 1 1 3 3v2h2v-2a5 5 0 0 0 0-10Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
];

function Icon({ name }) {
  switch (name) {
    case "grid":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"
            fill="currentColor"
          />
        </svg>
      );
    case "wallet":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 7V6a2 2 0 0 1 2-2h13v2H6v1h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm0 2v8h16V9H4Zm12 3h3v4h-3v-4Z"
            fill="currentColor"
          />
        </svg>
      );
    case "users":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4ZM8 12a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm8 2c-2.67 0-8 1.34-8 4v1h16v-1c0-2.66-5.33-4-8-4Zm-8-.5C5 13.5 0 15 0 18v1h7v-1a4.64 4.64 0 0 1 1-2.67A10.55 10.55 0 0 0 8 13.5Z"
            fill="currentColor"
          />
        </svg>
      );
    case "person":
    default:
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5Z"
            fill="currentColor"
          />
        </svg>
      );
  }
}

function initialsFrom(name = "") {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function AppLayout() {
  const { user } = useAuth0();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/dashboard" className="sidebar__brand">
          <span className="sidebar__pill">Pro</span>
          <div>
            <strong>Swallet</strong>
            <small>Hackathon Console</small>
          </div>
        </Link>

        <div className="sidebar__badge">Sponsor Mode</div>

        <div className="sidebar__constellation" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <p className="sidebar__intro">Precision controls for your shared expenses.</p>

        <nav className="sidebar__nav">
          {primaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar__link ${isActive ? "is-active" : ""}`
              }
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            {user?.picture ? (
              <img src={user.picture} alt={user.name} />
            ) : (
              <div className="sidebar__avatar-fallback">
                {initialsFrom(user?.name || "SP")}
              </div>
            )}
            <div>
              <p>{user?.name || "Member"}</p>
              <span>{user?.email}</span>
            </div>
          </div>
          <LogoutButton variant="ghost" />
        </div>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <div className="header-primary">
            <p className="eyebrow">Swallet HQ</p>
            <h1>Welcome back{user?.given_name ? `, ${user.given_name}` : ""}</h1>
            <p>Monitor balances, manage crews, and keep every split under control.</p>
          </div>

          <div className="header-actions">
            <div className="quick-links quick-links--icons">
              {quickLinks.map((link) => (
                <Link key={link.to} to={link.to} className="quick-link">
                  <span className="quick-link__icon">{link.icon}</span>
                  <span className="quick-link__label">{link.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
