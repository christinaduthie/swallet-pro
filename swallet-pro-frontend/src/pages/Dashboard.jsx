import React from "react";

export default function Dashboard() {
  // (Optional) check token existence; redirect if missing
  const token = localStorage.getItem("token");

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <h1>Hello</h1>
      {!token && <p style={{ position: "fixed", bottom: 16, opacity: 0.7 }}>
        (No token found — you can still see this page for now.)
      </p>}
    </div>
  );
}
