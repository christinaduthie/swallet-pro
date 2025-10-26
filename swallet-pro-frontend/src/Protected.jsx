import React, { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

export default function Protected({ children }) {
  const { isAuthenticated, isLoading, user } = useAuth0();
  const loc = useLocation();

  useEffect(() => {
    if (isAuthenticated && user?.email) {
      localStorage.setItem("token", `fake|${user.email}`);
    } else if (!isLoading) {
      localStorage.removeItem("token");
    }
  }, [isAuthenticated, isLoading, user]);

  if (isLoading) {
    return <div style={{ padding: 24 }}>Loading…</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: loc }} replace />;
  }

  return children;
}
