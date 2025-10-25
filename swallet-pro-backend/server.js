import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Mock login: accept any non-empty email/password and return a fake token
app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }
  return res.json({ token: "fake-jwt-token-123" });
});

// (Optional) protected check
app.get("/api/me", (req, res) => {
  const auth = req.headers.authorization || "";
  if (auth === "Bearer fake-jwt-token-123") {
    return res.json({ email: "user@example.com" });
  }
  return res.status(401).json({ message: "Unauthorized" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
