import { useAuth0 } from "@auth0/auth0-react";

export default function LoginButton() {
  const { loginWithRedirect, isAuthenticated } = useAuth0();

  if (isAuthenticated) return null;

  return (
    <button
      onClick={() => loginWithRedirect()}
      style={{
        padding: "10px 16px",
        borderRadius: 8,
        border: "none",
        background: "#0f172a",
        color: "white",
        cursor: "pointer",
        minWidth: 140,
      }}
    >
      Sign In
    </button>
  );
}
