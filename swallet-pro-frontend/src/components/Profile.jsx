import { useAuth0 } from "@auth0/auth0-react";

export default function Profile() {
  const { user, isAuthenticated } = useAuth0();

  if (!isAuthenticated || !user) return null;

  return (
    <article
      className="column"
      style={{
        display: "grid",
        gap: 12,
        alignItems: "center",
        justifyItems: "center",
        textAlign: "center",
      }}
    >
      {user.picture && (
        <img
          src={user.picture}
          alt={user.name}
          style={{ width: 96, height: 96, borderRadius: "50%" }}
        />
      )}
      <h2 style={{ margin: 0 }}>{user.name}</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, textAlign: "left" }}>
        {Object.keys(user).map((key) => (
          <li key={key} style={{ fontSize: 14 }}>
            <strong>{key}:</strong> {String(user[key])}
          </li>
        ))}
      </ul>
    </article>
  );
}
