import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import Profile from "../components/Profile.jsx";
import LogoutButton from "../components/LogoutButton.jsx";

export default function Dashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, error, user } = useAuth0();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        localStorage.removeItem("token");
        navigate("/", { replace: true });
      } else if (user?.email) {
        localStorage.setItem("token", `fake|${user.email}`);
      }
    }
  }, [isAuthenticated, isLoading, user, navigate]);

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p style={{ color: "#b91c1c" }}>Authentication error</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        gap: 24,
      }}
    >
      <div style={{ display: "grid", gap: 16, justifyItems: "center" }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <Profile />
        <LogoutButton />
      </div>
    </div>
  );
}
