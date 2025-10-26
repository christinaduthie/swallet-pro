import { useAuth0 } from "@auth0/auth0-react";

export default function LogoutButton({ variant = "secondary", className = "" }) {
  const { logout, isAuthenticated } = useAuth0();

  if (!isAuthenticated) return null;

  return (
    <button
      className={`btn ${variant === "ghost" ? "btn-ghost" : "btn-secondary"} ${className}`.trim()}
      onClick={() => {
        localStorage.removeItem("token");
        logout({ logoutParams: { returnTo: window.location.origin } });
      }}
    >
      Sign Out
    </button>
  );
}
