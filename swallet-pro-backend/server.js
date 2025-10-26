import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const { PORT = 4000, DATABASE_URL } = process.env;
const app = Fastify({ logger: false });
await app.register(cors, { origin: true });

/* ---------- DB ---------- */
const pool = new Pool({ connectionString: DATABASE_URL });
async function db(q, params = []) {
  const client = await pool.connect();
  try {
    const res = await client.query(q, params);
    return res;
  } finally {
    client.release();
  }
}

/* ---------- Auth Hook (simple dev token) ---------- */
const PUBLIC_PATHS = ["/api/health", "/api/signup", "/api/login"];
app.addHook("onRequest", async (req, reply) => {
  if (PUBLIC_PATHS.some((p) => req.url.startsWith(p))) return;

  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    reply.code(401).send({ message: "Unauthorized" });
    return;
  }

  const token = auth.slice("Bearer ".length);
  const [prefix, email] = token.split("|");
  if (prefix !== "fake" || !email) {
    reply.code(401).send({ message: "Invalid token" });
    return;
  }

  try {
    const displayName = email.split("@")[0];
    const u = await db(
      `INSERT INTO users (email, display_name)
       VALUES ($1,$2)
       ON CONFLICT (email) DO UPDATE SET display_name = COALESCE(users.display_name,$2)
       RETURNING id,email,display_name`,
      [email, displayName]
    );
    req.user = { id: u.rows[0].id, email: u.rows[0].email };
  } catch (e) {
    reply.code(401).send({ message: "Unauthorized", error: e.message });
  }
});

/* ---------- Public Routes ---------- */
app.get("/api/health", async () => {
  await db("SELECT 1");
  return { ok: true };
});

app.post("/api/signup", async (req, reply) => {
  const { email, password, display_name } = req.body || {};
  if (!email || !password)
    return reply.code(400).send({ message: "email and password required" });

  const exists = await db(`SELECT id FROM users WHERE email=$1`, [email]);
  if (exists.rowCount > 0)
    return reply.code(409).send({ message: "account already exists" });

  const hash = await bcrypt.hash(password, 10);
  const u = await db(
    `INSERT INTO users (email, display_name, password_hash)
     VALUES ($1,$2,$3)
     RETURNING id,email,display_name`,
    [email, display_name || email.split("@")[0], hash]
  );

  return { token: `fake|${u.rows[0].email}` };
});

app.post("/api/login", async (req, reply) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return reply.code(400).send({ message: "email and password required" });

  const r = await db(
    `SELECT id,email,password_hash FROM users WHERE email=$1`,
    [email]
  );
  if (r.rowCount === 0) {
    await db(
      `INSERT INTO users (email, display_name)
       VALUES ($1,$2)
       ON CONFLICT (email) DO NOTHING`,
      [email, email.split("@")[0]]
    );
    return { token: `fake|${email}` };
  }

  const { password_hash } = r.rows[0];
  if (!password_hash) return { token: `fake|${email}` };

  const ok = await bcrypt.compare(password, password_hash);
  if (!ok) return reply.code(401).send({ message: "invalid credentials" });

  return { token: `fake|${email}` };
});

/* ---------- Groups ---------- */
app.get("/api/groups", async () => {
  const r = await db(
    `SELECT g.id, g.name, g.currency,
            COALESCE(SUM(CASE WHEN t.status='paid' THEN t.amount_cents ELSE 0 END),0) AS paid_cents
     FROM groups g
     LEFT JOIN transactions t ON t.group_id = g.id
     GROUP BY g.id
     ORDER BY g.created_at DESC`
  );
  return r.rows;
});

app.post("/api/groups", async (req, reply) => {
  const { name, currency = "USD" } = req.body || {};
  if (!name) return reply.code(400).send({ message: "name required" });

  const g = await db(
    `INSERT INTO groups (name,currency,created_by)
     VALUES ($1,$2,$3) RETURNING id,name,currency`,
    [name, currency, req.user.id]
  );
  const gid = g.rows[0].id;

  await db(
    `INSERT INTO group_members (group_id,user_id,role)
     VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING`,
    [gid, req.user.id]
  );

  return g.rows[0];
});

app.get("/api/groups/:id", async (req, reply) => {
  const { id } = req.params;
  const g = await db(`SELECT * FROM groups WHERE id=$1`, [id]);
  if (g.rowCount === 0) return reply.code(404).send({ message: "not found" });

  const members = await db(
    `SELECT gm.user_id as id, u.email, gm.role, gm.auto_pay_enabled
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id=$1`,
    [id]
  );
  return { ...g.rows[0], members: members.rows };
});

app.post("/api/groups/:id/members", async (req, reply) => {
  const { id } = req.params;
  const { email, role = "member" } = req.body || {};
  if (!email) return reply.code(400).send({ message: "email required" });

  const u = await db(
    `INSERT INTO users (email, display_name)
     VALUES ($1,$2)
     ON CONFLICT (email) DO UPDATE SET display_name = COALESCE(users.display_name,$2)
     RETURNING id`,
    [email, email.split("@")[0]]
  );

  await db(
    `INSERT INTO group_members (group_id,user_id,role)
     VALUES ($1,$2,$3)
     ON CONFLICT (group_id,user_id) DO NOTHING`,
    [id, u.rows[0].id, role]
  );
  return { ok: true };
});

/* ---------- Ledger / Transactions ---------- */
app.get("/api/groups/:id/ledger", async (req, reply) => {
  const { id } = req.params;
  const r = await db(
    `SELECT t.id, t.type, t.amount_cents, t.description, t.status, t.created_at,
            u.email AS created_by_email
     FROM transactions t
     JOIN users u ON u.id = t.created_by
     WHERE t.group_id=$1
     ORDER BY t.created_at DESC`,
    [id]
  );
  return r.rows;
});

app.post("/api/transactions", async (req, reply) => {
  const { group_id, type, amount_cents, description } = req.body || {};
  if (!group_id || !type || !amount_cents)
    return reply.code(400).send({ message: "group_id, type, amount_cents required" });

  const mem = await db(
    `SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2`,
    [group_id, req.user.id]
  );
  if (mem.rowCount === 0)
    return reply.code(403).send({ message: "not a member" });

  const r = await db(
    `INSERT INTO transactions (group_id,type,amount_cents,description,status,created_by)
     VALUES ($1,$2,$3,$4,'pending',$5) RETURNING id`,
    [group_id, type, amount_cents, description || null, req.user.id]
  );
  return { id: r.rows[0].id };
});

/* ---------- Approvals ---------- */
app.post("/api/approvals/:txId", async (req, reply) => {
  const { txId } = req.params;
  const { decision } = req.body || {};
  if (!["approve", "reject"].includes(decision))
    return reply.code(400).send({ message: "decision must be approve|reject" });

  await db(
    `INSERT INTO approvals (transaction_id, approver_id, decision)
     VALUES ($1,$2,$3)
     ON CONFLICT (transaction_id, approver_id)
     DO UPDATE SET decision=EXCLUDED.decision, decided_at=NOW()`,
    [txId, req.user.id, decision]
  );

  const r = await db(
    `SELECT
       SUM(CASE WHEN decision='approve' THEN 1 ELSE 0 END) AS approves,
       SUM(CASE WHEN decision='reject'  THEN 1 ELSE 0 END) AS rejects
     FROM approvals WHERE transaction_id=$1`,
    [txId]
  );
  const approves = Number(r.rows[0].approves || 0);
  const rejects = Number(r.rows[0].rejects || 0);

  if (rejects > 0)
    await db(`UPDATE transactions SET status='rejected' WHERE id=$1`, [txId]);
  else if (approves >= 2)
    await db(`UPDATE transactions SET status='paid' WHERE id=$1`, [txId]);
  else
    await db(`UPDATE transactions SET status='approved' WHERE id=$1`, [txId]);

  return { ok: true, approves, rejects };
});

/* ---------- Comments ---------- */
app.get("/api/transactions/:id/comments", async (req) => {
  const { id } = req.params;
  const r = await db(
    `SELECT c.id, c.body, c.created_at, u.email AS author
     FROM comments c JOIN users u ON u.id = c.author_id
     WHERE c.transaction_id=$1 ORDER BY c.created_at ASC`,
    [id]
  );
  return r.rows;
});

app.post("/api/transactions/:id/comments", async (req, reply) => {
  const { id } = req.params;
  const { body } = req.body || {};
  if (!body) return reply.code(400).send({ message: "body required" });
  await db(
    `INSERT INTO comments (transaction_id, author_id, body)
     VALUES ($1,$2,$3)`,
    [id, req.user.id, body]
  );
  return { ok: true };
});

/* ---------- Accounts ---------- */
app.get("/api/accounts/:userId", async (req) => {
  const { userId } = req.params;
  const r = await db(`SELECT * FROM accounts WHERE user_id=$1`, [userId]);
  return r.rows;
});

/* ---------- Contacts ---------- */
app.get("/api/contacts", async (req) => {
  const r = await db(`SELECT * FROM contacts WHERE owner_id=$1`, [req.user.id]);
  return r.rows;
});

app.post("/api/contacts", async (req, reply) => {
  const { contact_name, contact_email } = req.body || {};
  if (!contact_name)
    return reply.code(400).send({ message: "contact_name required" });
  await db(
    `INSERT INTO contacts (owner_id, contact_name, contact_email)
     VALUES ($1,$2,$3)`,
    [req.user.id, contact_name, contact_email || null]
  );
  return { ok: true };
});

/* ---------- Notifications ---------- */
app.get("/api/notifications", async (req) => {
  const r = await db(
    `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC`,
    [req.user.id]
  );
  return r.rows;
});

/* ---------- Settings ---------- */
app.get("/api/settings", async (req) => {
  const r = await db(`SELECT * FROM settings WHERE user_id=$1`, [req.user.id]);
  return r.rows[0] || {};
});

app.put("/api/settings", async (req, reply) => {
  const { language, theme, audio_assist } = req.body || {};
  await db(
    `INSERT INTO settings (user_id, language, theme, audio_assist)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id)
     DO UPDATE SET language=$2, theme=$3, audio_assist=$4`,
    [req.user.id, language || "en", theme || "light", audio_assist || false]
  );
  return { ok: true };
});

/* ---------- Error Handler ---------- */
app.setErrorHandler((err, req, reply) => {
  console.error("💥 Server Error:", err);
  reply.code(500).send({ message: "Internal Server Error", error: err.message });
});

/* ---------- Start Server ---------- */
app
  .listen({ port: Number(PORT), host: "0.0.0.0" })
  .then(() => console.log(`🚀 Swallet Pro API running on http://localhost:${PORT}`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
