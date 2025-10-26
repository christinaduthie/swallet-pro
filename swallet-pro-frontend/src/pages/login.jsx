import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import LoginButton from "../components/LoginButton.jsx";

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, error } = useAuth0();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div
        style={{
          width: 320,
          display: "grid",
          gap: 12,
          padding: 20,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
        }}
      >
        <h1 style={{ margin: 0, textAlign: "center" }}>Auth0 Login</h1>

        {error && (
          <p style={{ color: "#b91c1c", fontSize: 14, textAlign: "center" }}>
            Authentication error
          </p>
        )}

        {!error && isLoading && (
          <p style={{ textAlign: "center", color: "#475569" }}>Loading…</p>
        )}

        {!error && !isLoading && (
          <div style={{ display: "grid", placeItems: "center" }}>
            <LoginButton />
          </div>
        )}
      </div>
    </main>
  );
}
