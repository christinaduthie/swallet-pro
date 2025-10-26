import { useAuth0 } from "@auth0/auth0-react";

export default function LogoutButton() {
  const { logout, isAuthenticated } = useAuth0();

  if (!isAuthenticated) return null;

  return (
    <button
      onClick={() => {
        localStorage.removeItem("token");
        logout({ logoutParams: { returnTo: window.location.origin } });
      }}
      style={{
        padding: "10px 16px",
        borderRadius: 8,
        border: "1px solid #cbd5e1",
        background: "white",
        color: "#0f172a",
        cursor: "pointer",
        minWidth: 140,
      }}
    >
      Sign Out
    </button>
  );
}
