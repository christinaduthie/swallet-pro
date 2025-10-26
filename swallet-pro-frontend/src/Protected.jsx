import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export default function Protected({ children }) {
  const token = localStorage.getItem("token");
  const loc = useLocation();
  if (!token) return <Navigate to="/" state={{ from: loc }} replace />;
  return children;
}