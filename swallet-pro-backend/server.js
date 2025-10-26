import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const { PORT = 4000, DATABASE_URL } = process.env;
const app = Fastify({ logger: false });
await app.register(cors, { origin: true });

/* ---------- DB Helpers ---------- */
const pool = new Pool({ connectionString: DATABASE_URL });
async function db(query, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(query, params);
  } finally {
    client.release();
  }
}

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.statusCode = status;
  }
}

const normalizeEmail = (email = "") => email.trim().toLowerCase();
const allowedAccountTypes = new Set(["checking", "savings", "credit", "loan"]);
const allowedRoles = new Set(["owner", "admin", "member", "viewer", "minor"]);
const allowedTxTypes = new Set(["collect", "spend", "reimburse"]);
const managerRoles = new Set(["owner", "admin"]);

const toCents = (value) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isInteger(value)) return value;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100);
};

const parseAmountInput = (payload, key, fallback = 0) => {
  if (!payload) return fallback;
  const centsKey = `${key}_cents`;
  if (
    centsKey in payload &&
    payload[centsKey] !== undefined &&
    payload[centsKey] !== null &&
    `${payload[centsKey]}`.trim() !== ""
  ) {
    const raw = Number(payload[centsKey]);
    return Number.isFinite(raw) ? Math.round(raw) : fallback;
  }
  const converted = toCents(payload[key]);
  return Number.isInteger(converted) ? converted : fallback;
};

const parseJSON = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

async function getAccountsForUser(userId) {
  const res = await db(
    `SELECT id, institution_name, account_type, account_number_last4,
            routing_number, currency, balance_cents, available_credit_cents,
            total_debits_cents, total_credits_cents, is_default, created_at
     FROM accounts
     WHERE user_id=$1
     ORDER BY created_at DESC`,
    [userId]
  );
  return res.rows;
}

async function ensureAccountOwnership(accountId, userId) {
  if (!accountId) return null;
  const res = await db(`SELECT id FROM accounts WHERE id=$1 AND user_id=$2`, [
    accountId,
    userId,
  ]);
  if (res.rowCount === 0) {
    throw new ApiError(404, "Account not found");
  }
  return res.rows[0];
}

async function setDefaultAccount(userId, accountId) {
  await db(`UPDATE accounts SET is_default=false WHERE user_id=$1`, [userId]);
  await db(
    `UPDATE accounts SET is_default=true WHERE id=$1 AND user_id=$2`,
    [accountId, userId]
  );
}

async function getMembership(groupId, email) {
  const res = await db(
    `SELECT id, role, permissions
     FROM group_members
     WHERE group_id=$1 AND LOWER(email)=LOWER($2)`,
    [groupId, normalizeEmail(email)]
  );
  return res.rows[0] || null;
}

async function requireMembership(groupId, email) {
  const membership = await getMembership(groupId, email);
  if (!membership) throw new ApiError(404, "Group not found");
  return membership;
}

async function fetchGroupStats(groupId) {
  const res = await db(
    `SELECT
       COUNT(DISTINCT gm.id) AS member_count,
       COALESCE(SUM(CASE WHEN t.status='paid' THEN t.amount_cents ELSE 0 END),0) AS paid_total_cents,
       COALESCE(SUM(CASE WHEN t.status IN ('pending','approved') THEN t.amount_cents ELSE 0 END),0) AS outstanding_cents,
       MIN(CASE WHEN t.status IN ('pending','approved') THEN COALESCE(t.due_date, t.created_at + INTERVAL '3 days') END) AS next_due_date
     FROM group_members gm
     LEFT JOIN transactions t ON t.group_id = gm.group_id
     WHERE gm.group_id=$1
     GROUP BY gm.group_id`,
    [groupId]
  );
  return (
    res.rows[0] || {
      member_count: 0,
      paid_total_cents: 0,
      outstanding_cents: 0,
      next_due_date: null,
    }
  );
}

async function fetchUpcomingPayments(email) {
  const res = await db(
    `SELECT
       t.id,
       t.description,
       t.amount_cents,
       t.status,
       t.due_date,
       COALESCE(t.due_date, t.created_at + INTERVAL '3 days') AS due_on,
       g.name AS group_name,
       g.currency
     FROM transactions t
     JOIN groups g ON g.id = t.group_id
     JOIN group_members gm ON gm.group_id = g.id AND LOWER(gm.email)=LOWER($1)
     WHERE t.status IN ('pending','approved')
     ORDER BY due_on ASC
     LIMIT 8`,
    [normalizeEmail(email)]
  );
  return res.rows;
}

async function fetchRecentTransactions(email) {
  const res = await db(
    `SELECT
       t.id,
       t.description,
       t.amount_cents,
       t.status,
       t.type,
       t.created_at,
       g.name AS group_name,
       g.currency
     FROM transactions t
     JOIN groups g ON g.id = t.group_id
     JOIN group_members gm ON gm.group_id = g.id AND LOWER(gm.email)=LOWER($1)
     ORDER BY t.created_at DESC
     LIMIT 10`,
    [normalizeEmail(email)]
  );
  return res.rows;
}

async function createTransactionForGroup({ groupId, payload = {}, user }) {
  if (!groupId) throw new ApiError(400, "group_id required");
  await requireMembership(groupId, user.email);
  const type = payload.type || "collect";
  if (!allowedTxTypes.has(type)) {
    throw new ApiError(400, "invalid transaction type");
  }
  const centsValue = parseAmountInput(payload, "amount");
  if (!Number.isInteger(centsValue) || centsValue <= 0) {
    throw new ApiError(400, "amount must be a positive number");
  }
  let accountId = payload.account_id || null;
  if (accountId) await ensureAccountOwnership(accountId, user.id);
  let dueDate = null;
  if (payload.due_date) {
    const parsed = new Date(payload.due_date);
    if (!Number.isNaN(parsed.valueOf())) dueDate = parsed;
  }
  const metadata = JSON.stringify(payload.metadata || {});
  const inserted = await db(
    `INSERT INTO transactions
       (group_id,type,amount_cents,description,status,created_by,due_date,account_id,metadata)
     VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8)
     RETURNING *`,
    [
      groupId,
      type,
      centsValue,
      payload.description || null,
      user.email,
      dueDate,
      accountId,
      metadata,
    ]
  );
  return inserted.rows[0];
}

/* ---------- Auth Hook ---------- */
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
    req.user = {
      id: u.rows[0].id,
      email: u.rows[0].email,
      name: u.rows[0].display_name || displayName,
    };
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
     RETURNING email`,
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

/* ---------- Dashboard ---------- */
app.get("/api/dashboard", async (req) => {
  const [accounts, upcoming, recent] = await Promise.all([
    getAccountsForUser(req.user.id),
    fetchUpcomingPayments(req.user.email),
    fetchRecentTransactions(req.user.email),
  ]);

  const totals = accounts.reduce(
    (acc, item) => {
      acc.balance_cents += item.balance_cents || 0;
      acc.available_credit_cents += item.available_credit_cents || 0;
      acc.total_debits_cents += item.total_debits_cents || 0;
      acc.total_credits_cents += item.total_credits_cents || 0;
      return acc;
    },
    {
      balance_cents: 0,
      available_credit_cents: 0,
      total_debits_cents: 0,
      total_credits_cents: 0,
    }
  );

  return { accounts, totals, upcoming, recent };
});

/* ---------- Accounts ---------- */
app.get("/api/accounts", async (req) => {
  const accounts = await getAccountsForUser(req.user.id);
  const totals = accounts.reduce(
    (acc, item) => {
      acc.balance_cents += item.balance_cents || 0;
      acc.available_credit_cents += item.available_credit_cents || 0;
      acc.total_debits_cents += item.total_debits_cents || 0;
      acc.total_credits_cents += item.total_credits_cents || 0;
      return acc;
    },
    {
      balance_cents: 0,
      available_credit_cents: 0,
      total_debits_cents: 0,
      total_credits_cents: 0,
    }
  );
  return { accounts, totals };
});

app.get("/api/accounts/:userId", async (req, reply) => {
  if (req.params.userId !== req.user.id) {
    return reply.code(403).send({ message: "Forbidden" });
  }
  return getAccountsForUser(req.user.id);
});

app.post("/api/accounts", async (req, reply) => {
  const body = req.body || {};
  const {
    institution_name,
    account_type,
    account_number_last4,
    routing_number,
    currency = "USD",
    is_default = false,
  } = body;

  if (!institution_name || !account_number_last4) {
    return reply
      .code(400)
      .send({ message: "institution_name and account_number_last4 required" });
  }

  if (account_type && !allowedAccountTypes.has(account_type)) {
    return reply.code(400).send({ message: "invalid account_type" });
  }

  const inserted = await db(
    `INSERT INTO accounts
       (user_id,institution_name,account_type,account_number_last4,routing_number,currency,
        balance_cents,available_credit_cents,total_debits_cents,total_credits_cents,is_default)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      req.user.id,
      institution_name.trim(),
      account_type || null,
      account_number_last4.trim().slice(-4),
      routing_number?.trim() || null,
      currency,
      parseAmountInput(body, "balance"),
      parseAmountInput(body, "available_credit"),
      parseAmountInput(body, "total_debits"),
      parseAmountInput(body, "total_credits"),
      Boolean(is_default),
    ]
  );

  if (is_default) {
    await setDefaultAccount(req.user.id, inserted.rows[0].id);
    inserted.rows[0].is_default = true;
  }

  reply.code(201).send(inserted.rows[0]);
});

app.put("/api/accounts/:id", async (req, reply) => {
  const { id } = req.params;
  await ensureAccountOwnership(id, req.user.id);
  const body = req.body || {};
  const { account_type } = body;

  if (account_type && !allowedAccountTypes.has(account_type)) {
    return reply.code(400).send({ message: "invalid account_type" });
  }

  const updated = await db(
    `UPDATE accounts SET
       institution_name=COALESCE($1, institution_name),
       account_type=COALESCE($2, account_type),
       account_number_last4=COALESCE($3, account_number_last4),
       routing_number=COALESCE($4, routing_number),
       currency=COALESCE($5, currency),
       balance_cents=COALESCE($6, balance_cents),
       available_credit_cents=COALESCE($7, available_credit_cents),
       total_debits_cents=COALESCE($8, total_debits_cents),
       total_credits_cents=COALESCE($9, total_credits_cents)
     WHERE id=$10 AND user_id=$11
     RETURNING *`,
    [
      body.institution_name?.trim() || null,
      account_type || null,
      body.account_number_last4 ? body.account_number_last4.trim().slice(-4) : null,
      body.routing_number?.trim() || null,
      body.currency || null,
      body.balance === undefined && body.balance_cents === undefined
        ? null
        : parseAmountInput(body, "balance"),
      body.available_credit === undefined && body.available_credit_cents === undefined
        ? null
        : parseAmountInput(body, "available_credit"),
      body.total_debits === undefined && body.total_debits_cents === undefined
        ? null
        : parseAmountInput(body, "total_debits"),
      body.total_credits === undefined && body.total_credits_cents === undefined
        ? null
        : parseAmountInput(body, "total_credits"),
      id,
      req.user.id,
    ]
  );

  if (updated.rowCount === 0) {
    return reply.code(404).send({ message: "Account not found" });
  }

  if (body.is_default === true) {
    await setDefaultAccount(req.user.id, id);
    updated.rows[0].is_default = true;
  }

  return updated.rows[0];
});

app.delete("/api/accounts/:id", async (req, reply) => {
  const { id } = req.params;
  await ensureAccountOwnership(id, req.user.id);
  await db(`DELETE FROM accounts WHERE id=$1 AND user_id=$2`, [
    id,
    req.user.id,
  ]);
  return { ok: true };
});

app.post("/api/accounts/:id/default", async (req, reply) => {
  const { id } = req.params;
  await ensureAccountOwnership(id, req.user.id);
  await setDefaultAccount(req.user.id, id);
  return { ok: true };
});

/* ---------- Groups Overview ---------- */
app.get("/api/groups", async (req) => {
  const res = await db(
    `SELECT
       g.id,
       g.name,
       g.currency,
       g.created_at,
       COALESCE(gc.purpose, '') AS purpose,
       COALESCE(gc.auto_pay_enabled, false) AS auto_pay_enabled,
       COALESCE(gc.approval_threshold, 1) AS approval_threshold,
       COUNT(DISTINCT gm_all.id) AS member_count,
       COALESCE(SUM(CASE WHEN t.status='paid' THEN t.amount_cents ELSE 0 END),0) AS balance_cents,
       MIN(CASE WHEN t.status IN ('pending','approved') THEN COALESCE(t.due_date, t.created_at + INTERVAL '3 days') END) AS next_due_on,
       BOOL_OR(t.status IN ('pending','approved')) AS has_open_items
     FROM groups g
     JOIN group_members gm_self ON gm_self.group_id = g.id AND LOWER(gm_self.email)=LOWER($1)
     LEFT JOIN group_members gm_all ON gm_all.group_id = g.id
     LEFT JOIN transactions t ON t.group_id = g.id
     LEFT JOIN group_configs gc ON gc.group_id = g.id
     GROUP BY g.id, gc.purpose, gc.auto_pay_enabled, gc.approval_threshold
     ORDER BY g.created_at DESC`,
    [normalizeEmail(req.user.email)]
  );
  return res.rows.map((row) => ({
    ...row,
    status: row.has_open_items ? "active" : "settled",
  }));
});

app.post("/api/groups", async (req, reply) => {
  const body = req.body || {};
  const {
    name,
    currency = "USD",
    purpose = "",
    base_account_id,
    contribution_amount,
    auto_pay_enabled = false,
    auto_pay_day = null,
    approval_threshold = 1,
    spending_limit,
    destination_account_id,
    rules = {},
    members = [],
  } = body;

  if (!name) return reply.code(400).send({ message: "name required" });

  if (base_account_id) await ensureAccountOwnership(base_account_id, req.user.id);
  if (destination_account_id)
    await ensureAccountOwnership(destination_account_id, req.user.id);

  const g = await db(
    `INSERT INTO groups (name,currency)
     VALUES ($1,$2) RETURNING id,name,currency,created_at`,
    [name.trim(), currency]
  );

  await db(
    `INSERT INTO group_configs
       (group_id,purpose,base_account_id,contribution_amount_cents,auto_pay_enabled,auto_pay_day,approval_threshold,spending_limit_cents,destination_account_id,rules)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (group_id)
     DO UPDATE SET
       purpose=EXCLUDED.purpose,
       base_account_id=EXCLUDED.base_account_id,
       contribution_amount_cents=EXCLUDED.contribution_amount_cents,
       auto_pay_enabled=EXCLUDED.auto_pay_enabled,
       auto_pay_day=EXCLUDED.auto_pay_day,
       approval_threshold=EXCLUDED.approval_threshold,
       spending_limit_cents=EXCLUDED.spending_limit_cents,
       destination_account_id=EXCLUDED.destination_account_id,
       rules=EXCLUDED.rules,
       updated_at=NOW()`,
    [
      g.rows[0].id,
      purpose || null,
      base_account_id || null,
      parseAmountInput(body, "contribution_amount"),
      Boolean(auto_pay_enabled),
      auto_pay_day || null,
      approval_threshold || 1,
      parseAmountInput(body, "spending_limit"),
      destination_account_id || null,
      JSON.stringify(rules || {}),
    ]
  );

  await db(
    `INSERT INTO group_members (group_id,email,role,display_name,permissions)
     VALUES ($1,$2,'owner',$3,$4)
     ON CONFLICT (group_id,email) DO NOTHING`,
    [
      g.rows[0].id,
      req.user.email,
      req.user.name || req.user.email.split("@")[0],
      JSON.stringify({ canApprove: true, canInvite: true }),
    ]
  );

  if (Array.isArray(members)) {
    for (const member of members) {
      if (!member?.email) continue;
      const role = allowedRoles.has(member.role) ? member.role : "member";
      await db(
        `INSERT INTO users (email, display_name)
         VALUES ($1,$2)
         ON CONFLICT (email) DO NOTHING`,
        [member.email, member.display_name || member.email.split("@")[0]]
      );
      await db(
        `INSERT INTO group_members (group_id,email,role,display_name,permissions)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (group_id,email) DO UPDATE SET
           role=EXCLUDED.role,
           display_name=COALESCE(EXCLUDED.display_name, group_members.display_name),
           permissions=EXCLUDED.permissions`,
        [
          g.rows[0].id,
          member.email,
          role,
          member.display_name || null,
          JSON.stringify(member.permissions || {}),
        ]
      );
    }
  }

  reply.code(201).send(g.rows[0]);
});

app.get("/api/groups/:id", async (req, reply) => {
  const { id } = req.params;
  const membership = await requireMembership(id, req.user.email);

  const groupRes = await db(
    `SELECT
       g.id,
       g.name,
       g.currency,
       g.created_at,
       gc.purpose,
       gc.auto_pay_enabled,
       gc.auto_pay_day,
       gc.contribution_amount_cents,
       gc.approval_threshold,
       gc.spending_limit_cents,
       gc.rules,
       base.id AS base_account_id,
       base.institution_name AS base_account_name,
       dest.id AS destination_account_id,
       dest.institution_name AS destination_account_name
     FROM groups g
     LEFT JOIN group_configs gc ON gc.group_id = g.id
     LEFT JOIN accounts base ON base.id = gc.base_account_id
     LEFT JOIN accounts dest ON dest.id = gc.destination_account_id
     WHERE g.id=$1`,
    [id]
  );
  if (groupRes.rowCount === 0) {
    return reply.code(404).send({ message: "not found" });
  }

  const membersRes = await db(
    `SELECT id, email, role, display_name, permissions
     FROM group_members
     WHERE group_id=$1
     ORDER BY CASE role
       WHEN 'owner' THEN 0
       WHEN 'admin' THEN 1
       WHEN 'member' THEN 2
       WHEN 'viewer' THEN 3
       ELSE 4
     END, LOWER(email)`,
    [id]
  );

  const stats = await fetchGroupStats(id);
  const group = groupRes.rows[0];
  group.rules = parseJSON(group.rules);

  return {
    ...group,
    stats,
    viewer_role: membership.role,
    members: membersRes.rows.map((m) => ({
      ...m,
      permissions: parseJSON(m.permissions),
    })),
  };
});

app.put("/api/groups/:id/policies", async (req, reply) => {
  const { id } = req.params;
  const membership = await requireMembership(id, req.user.email);
  if (!managerRoles.has(membership.role)) {
    return reply
      .code(403)
      .send({ message: "Only owners or admins can update policies" });
  }

  const body = req.body || {};
  const configRes = await db(
    `SELECT * FROM group_configs WHERE group_id=$1`,
    [id]
  );
  const existing = configRes.rows[0] || {};

  if (body.base_account_id && body.base_account_id !== existing.base_account_id) {
    await ensureAccountOwnership(body.base_account_id, req.user.id);
  }
  if (
    body.destination_account_id &&
    body.destination_account_id !== existing.destination_account_id
  ) {
    await ensureAccountOwnership(body.destination_account_id, req.user.id);
  }

  const merged = {
    purpose: body.purpose ?? existing.purpose ?? null,
    base_account_id: body.base_account_id ?? existing.base_account_id ?? null,
    contribution_amount_cents:
      body.contribution_amount !== undefined ||
      body.contribution_amount_cents !== undefined
        ? parseAmountInput(body, "contribution_amount")
        : existing.contribution_amount_cents || 0,
    auto_pay_enabled:
      body.auto_pay_enabled !== undefined
        ? Boolean(body.auto_pay_enabled)
        : Boolean(existing.auto_pay_enabled),
    auto_pay_day: body.auto_pay_day ?? existing.auto_pay_day ?? null,
    approval_threshold: body.approval_threshold ?? existing.approval_threshold ?? 1,
    spending_limit_cents:
      body.spending_limit !== undefined || body.spending_limit_cents !== undefined
        ? parseAmountInput(body, "spending_limit")
        : existing.spending_limit_cents || 0,
    destination_account_id:
      body.destination_account_id ?? existing.destination_account_id ?? null,
    rules: JSON.stringify(body.rules ?? parseJSON(existing.rules) ?? {}),
  };

  await db(
    `INSERT INTO group_configs
       (group_id,purpose,base_account_id,contribution_amount_cents,auto_pay_enabled,auto_pay_day,
        approval_threshold,spending_limit_cents,destination_account_id,rules)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (group_id)
     DO UPDATE SET
       purpose=EXCLUDED.purpose,
       base_account_id=EXCLUDED.base_account_id,
       contribution_amount_cents=EXCLUDED.contribution_amount_cents,
       auto_pay_enabled=EXCLUDED.auto_pay_enabled,
       auto_pay_day=EXCLUDED.auto_pay_day,
       approval_threshold=EXCLUDED.approval_threshold,
       spending_limit_cents=EXCLUDED.spending_limit_cents,
       destination_account_id=EXCLUDED.destination_account_id,
       rules=EXCLUDED.rules,
       updated_at=NOW()`,
    [
      id,
      merged.purpose,
      merged.base_account_id,
      merged.contribution_amount_cents,
      merged.auto_pay_enabled,
      merged.auto_pay_day,
      merged.approval_threshold,
      merged.spending_limit_cents,
      merged.destination_account_id,
      merged.rules,
    ]
  );

  return { ok: true };
});

app.post("/api/groups/:id/members", async (req, reply) => {
  const { id } = req.params;
  const membership = await requireMembership(id, req.user.email);
  if (!managerRoles.has(membership.role)) {
    return reply
      .code(403)
      .send({ message: "Only owners or admins can invite members" });
  }

  const { email, role = "member", display_name, permissions = {} } = req.body || {};
  if (!email) return reply.code(400).send({ message: "email required" });
  const safeRole = allowedRoles.has(role) ? role : "member";

  await db(
    `INSERT INTO users (email, display_name)
     VALUES ($1,$2)
     ON CONFLICT (email) DO NOTHING`,
    [email, display_name || email.split("@")[0]]
  );

  const inserted = await db(
    `INSERT INTO group_members (group_id,email,role,display_name,permissions)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (group_id,email) DO UPDATE SET
       role=EXCLUDED.role,
       display_name=COALESCE(EXCLUDED.display_name, group_members.display_name),
       permissions=EXCLUDED.permissions
     RETURNING *`,
    [id, email, safeRole, display_name || null, JSON.stringify(permissions || {})]
  );

  reply.code(201).send({
    ...inserted.rows[0],
    permissions: parseJSON(inserted.rows[0].permissions),
  });
});

app.put("/api/groups/:id/members/:memberId", async (req, reply) => {
  const { id, memberId } = req.params;
  const membership = await requireMembership(id, req.user.email);
  if (!managerRoles.has(membership.role)) {
    return reply
      .code(403)
      .send({ message: "Only owners or admins can update members" });
  }

  const memberRes = await db(
    `SELECT id, role FROM group_members WHERE id=$1 AND group_id=$2`,
    [memberId, id]
  );
  if (memberRes.rowCount === 0) {
    return reply.code(404).send({ message: "Member not found" });
  }

  const body = req.body || {};
  const nextRole = body.role && allowedRoles.has(body.role) ? body.role : memberRes.rows[0].role;
  if (
    memberRes.rows[0].role === "owner" &&
    nextRole !== "owner"
  ) {
    const cnt = await db(
      `SELECT COUNT(*)::int AS owners FROM group_members WHERE group_id=$1 AND role='owner'`,
      [id]
    );
    if (cnt.rows[0].owners <= 1) {
      return reply
        .code(400)
        .send({ message: "At least one owner is required" });
    }
  }

  const updated = await db(
    `UPDATE group_members
     SET role=$1,
         display_name=COALESCE($2, display_name),
         permissions=$3
     WHERE id=$4 AND group_id=$5
     RETURNING *`,
    [
      nextRole,
      body.display_name || null,
      JSON.stringify(body.permissions || {}),
      memberId,
      id,
    ]
  );

  return {
    ...updated.rows[0],
    permissions: parseJSON(updated.rows[0].permissions),
  };
});

app.delete("/api/groups/:id/members/:memberId", async (req, reply) => {
  const { id, memberId } = req.params;
  const membership = await requireMembership(id, req.user.email);
  if (!managerRoles.has(membership.role)) {
    return reply
      .code(403)
      .send({ message: "Only owners or admins can remove members" });
  }

  const memberRes = await db(
    `SELECT id, role FROM group_members WHERE id=$1 AND group_id=$2`,
    [memberId, id]
  );
  if (memberRes.rowCount === 0) {
    return reply.code(404).send({ message: "Member not found" });
  }

  if (memberRes.rows[0].role === "owner") {
    const cnt = await db(
      `SELECT COUNT(*)::int AS owners FROM group_members WHERE group_id=$1 AND role='owner'`,
      [id]
    );
    if (cnt.rows[0].owners <= 1) {
      return reply
        .code(400)
        .send({ message: "At least one owner is required" });
    }
  }

  await db(`DELETE FROM group_members WHERE id=$1 AND group_id=$2`, [
    memberId,
    id,
  ]);
  return { ok: true };
});

/* ---------- Ledger & Requests ---------- */
app.get("/api/groups/:id/ledger", async (req, reply) => {
  const { id } = req.params;
  await requireMembership(id, req.user.email);
  const filters = ["t.group_id=$1"];
  const params = [id];

  if (req.query?.type && allowedTxTypes.has(req.query.type)) {
    filters.push(`t.type=$${params.length + 1}`);
    params.push(req.query.type);
  }
  if (req.query?.status) {
    filters.push(`t.status=$${params.length + 1}`);
    params.push(req.query.status);
  }
  if (req.query?.member) {
    filters.push(`LOWER(t.created_by)=LOWER($${params.length + 1})`);
    params.push(req.query.member);
  }

  const r = await db(
    `SELECT
       t.id, t.type, t.amount_cents, t.description, t.status, t.created_at,
       t.created_by, t.due_date, t.metadata,
       COALESCE(acc.institution_name,'') AS account_name
     FROM transactions t
     LEFT JOIN accounts acc ON acc.id = t.account_id
     WHERE ${filters.join(" AND ")}
     ORDER BY t.created_at DESC`,
    params
  );

  return r.rows.map((row) => ({
    ...row,
    metadata: parseJSON(row.metadata),
  }));
});

app.get("/api/groups/:id/requests", async (req, reply) => {
  const { id } = req.params;
  await requireMembership(id, req.user.email);
  const r = await db(
    `SELECT
       t.id,
       t.type,
       t.amount_cents,
       t.description,
       t.status,
       t.due_date,
       t.created_at,
       t.created_by,
       COUNT(*) FILTER (WHERE a.decision='approve') AS approvals,
       COUNT(*) FILTER (WHERE a.decision='reject') AS rejections,
       jsonb_agg(
         jsonb_build_object(
           'id', a.id,
           'approver_email', a.approver_email,
           'decision', a.decision,
           'decided_at', a.decided_at
         )
         ORDER BY a.decided_at
       ) FILTER (WHERE a.id IS NOT NULL) AS history
     FROM transactions t
     LEFT JOIN approvals a ON a.transaction_id = t.id
     WHERE t.group_id=$1 AND t.status IN ('pending','approved')
     GROUP BY t.id
     ORDER BY COALESCE(t.due_date, t.created_at) ASC`,
    [id]
  );
  return r.rows;
});

app.get("/api/groups/:id/approvals", async (req, reply) => {
  const { id } = req.params;
  await requireMembership(id, req.user.email);
  const r = await db(
    `SELECT
       t.id,
       t.description,
       t.amount_cents,
       t.status,
       t.due_date,
       t.created_at,
       COALESCE(gc.approval_threshold,1) AS approval_threshold,
       COUNT(*) FILTER (WHERE a.decision='approve') AS approvals,
       COUNT(*) FILTER (WHERE a.decision='reject') AS rejections
     FROM transactions t
     LEFT JOIN approvals a ON a.transaction_id = t.id
     LEFT JOIN group_configs gc ON gc.group_id = t.group_id
     WHERE t.group_id=$1 AND t.status IN ('pending','approved')
     GROUP BY t.id, gc.approval_threshold
     ORDER BY t.created_at DESC`,
    [id]
  );
  return r.rows;
});

app.get("/api/groups/:id/activity", async (req, reply) => {
  const { id } = req.params;
  await requireMembership(id, req.user.email);
  const r = await db(
    `SELECT * FROM (
       SELECT t.id::text AS key, 'transaction' AS kind, t.created_at AS occurred_at,
              t.created_by AS actor, t.description AS body, t.status,
              t.amount_cents, NULL::text AS extra
       FROM transactions t WHERE t.group_id=$1
       UNION ALL
       SELECT a.id::text, 'approval', a.decided_at, a.approver_email,
              t.description, a.decision, NULL::int, NULL::text
       FROM approvals a JOIN transactions t ON t.id = a.transaction_id
       WHERE t.group_id=$1
       UNION ALL
       SELECT c.id::text, 'comment', c.created_at, u.email,
              c.body, 'comment', NULL::int, t.id::text
       FROM comments c
       JOIN users u ON u.id = c.author_id
       JOIN transactions t ON t.id = c.transaction_id
       WHERE t.group_id=$1
     ) feed
     ORDER BY occurred_at DESC
     LIMIT 25`,
    [id]
  );
  return r.rows;
});

app.get("/api/groups/:id/reports", async (req, reply) => {
  const { id } = req.params;
  await requireMembership(id, req.user.email);

  const summary = await db(
    `SELECT
       COALESCE(SUM(CASE WHEN status='paid' AND type='collect' THEN amount_cents ELSE 0 END),0) AS collected_cents,
       COALESCE(SUM(CASE WHEN status='paid' AND type='spend' THEN amount_cents ELSE 0 END),0) AS spent_cents,
       COALESCE(SUM(CASE WHEN status='pending' THEN amount_cents ELSE 0 END),0) AS pending_cents
     FROM transactions
     WHERE group_id=$1`,
    [id]
  );

  const monthly = await db(
    `SELECT date_trunc('month', created_at) AS month,
            SUM(CASE WHEN type='collect' THEN amount_cents ELSE 0 END) AS collect_cents,
            SUM(CASE WHEN type='spend' THEN amount_cents ELSE 0 END) AS spend_cents,
            SUM(CASE WHEN type='reimburse' THEN amount_cents ELSE 0 END) AS reimburse_cents
     FROM transactions
     WHERE group_id=$1
     GROUP BY month
     ORDER BY month DESC
     LIMIT 12`,
    [id]
  );

  return { summary: summary.rows[0], monthly: monthly.rows };
});

app.post("/api/groups/:id/requests", async (req, reply) => {
  const { id } = req.params;
  const tx = await createTransactionForGroup({
    groupId: id,
    payload: { ...req.body, type: req.body?.type || "collect" },
    user: req.user,
  });
  reply.code(201).send({ id: tx.id });
});

/* ---------- Transactions & Approvals ---------- */
app.post("/api/transactions", async (req, reply) => {
  try {
    const tx = await createTransactionForGroup({
      groupId: req.body?.group_id,
      payload: req.body,
      user: req.user,
    });
    reply.code(201).send({ id: tx.id });
  } catch (e) {
    if (e instanceof ApiError) {
      reply.code(e.statusCode).send({ message: e.message });
    } else {
      throw e;
    }
  }
});

app.post("/api/approvals/:txId", async (req, reply) => {
  const { txId } = req.params;
  const { decision } = req.body || {};
  if (!["approve", "reject"].includes(decision)) {
    return reply.code(400).send({ message: "decision must be approve|reject" });
  }

  const tx = await db(`SELECT group_id FROM transactions WHERE id=$1`, [txId]);
  if (tx.rowCount === 0) {
    return reply.code(404).send({ message: "Transaction not found" });
  }

  await requireMembership(tx.rows[0].group_id, req.user.email);

  await db(
    `INSERT INTO approvals (transaction_id, approver_email, decision)
     VALUES ($1,$2,$3)
     ON CONFLICT (transaction_id, approver_email)
     DO UPDATE SET decision=EXCLUDED.decision, decided_at=NOW()`,
    [txId, req.user.email, decision]
  );

  const counts = await db(
    `SELECT
       COUNT(*) FILTER (WHERE decision='approve') AS approvals,
       COUNT(*) FILTER (WHERE decision='reject') AS rejections
     FROM approvals WHERE transaction_id=$1`,
    [txId]
  );

  const thresholdRes = await db(
    `SELECT COALESCE(approval_threshold,1) AS threshold
     FROM group_configs WHERE group_id=$1`,
    [tx.rows[0].group_id]
  );

  const approvals = Number(counts.rows[0].approvals || 0);
  const rejects = Number(counts.rows[0].rejections || 0);
  const threshold = thresholdRes.rows[0]?.threshold || 1;

  let status = "approved";
  if (rejects > 0) status = "rejected";
  else if (approvals >= threshold) status = "paid";

  await db(`UPDATE transactions SET status=$1 WHERE id=$2`, [status, txId]);
  return { ok: true, approvals, rejects, status };
});

/* ---------- Comments ---------- */
async function requireTxMembership(txId, userEmail) {
  const tx = await db(`SELECT group_id FROM transactions WHERE id=$1`, [txId]);
  if (tx.rowCount === 0) throw new ApiError(404, "Transaction not found");
  await requireMembership(tx.rows[0].group_id, userEmail);
  return tx.rows[0].group_id;
}

app.get("/api/transactions/:id/comments", async (req, reply) => {
  const { id } = req.params;
  await requireTxMembership(id, req.user.email);
  const r = await db(
    `SELECT c.id, c.body, c.created_at, u.email AS author_email, u.display_name
     FROM comments c JOIN users u ON u.id = c.author_id
     WHERE c.transaction_id=$1 ORDER BY c.created_at ASC`,
    [id]
  );
  return r.rows;
});

app.post("/api/transactions/:id/comments", async (req, reply) => {
  const { id } = req.params;
  await requireTxMembership(id, req.user.email);
  const { body } = req.body || {};
  if (!body) return reply.code(400).send({ message: "body required" });
  await db(
    `INSERT INTO comments (transaction_id, author_id, body)
     VALUES ($1,$2,$3)`,
    [id, req.user.id, body]
  );
  return { ok: true };
});

/* ---------- Contacts / People ---------- */
app.get("/api/contacts", async (req) => {
  const { search } = req.query || {};
  const params = [req.user.id];
  const where = ["owner_id=$1"];
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(
      `(LOWER(contact_name) LIKE $${params.length} OR LOWER(COALESCE(contact_email,'')) LIKE $${params.length})`
    );
  }
  const r = await db(
    `SELECT * FROM contacts
     WHERE ${where.join(" AND ")}
     ORDER BY contact_name ASC`,
    params
  );
  return r.rows;
});

app.post("/api/contacts", async (req, reply) => {
  const body = req.body || {};
  const {
    contact_name,
    contact_email,
    contact_phone,
    can_send = false,
    can_receive = true,
    zelle_handle,
    venmo_handle,
    notes,
  } = body;

  if (!contact_name)
    return reply.code(400).send({ message: "contact_name required" });

  const inserted = await db(
    `INSERT INTO contacts
       (owner_id, contact_name, contact_email, contact_phone, can_send, can_receive, zelle_handle, venmo_handle, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      req.user.id,
      contact_name.trim(),
      contact_email?.trim() || null,
      contact_phone?.trim() || null,
      Boolean(can_send),
      Boolean(can_receive),
      zelle_handle || null,
      venmo_handle || null,
      notes || null,
    ]
  );

  reply.code(201).send(inserted.rows[0]);
});

app.put("/api/contacts/:id", async (req, reply) => {
  const { id } = req.params;
  const body = req.body || {};
  const updated = await db(
    `UPDATE contacts SET
       contact_name=COALESCE($1, contact_name),
       contact_email=$2,
       contact_phone=$3,
       can_send=COALESCE($4, can_send),
       can_receive=COALESCE($5, can_receive),
       zelle_handle=$6,
       venmo_handle=$7,
       notes=$8
     WHERE id=$9 AND owner_id=$10
     RETURNING *`,
    [
      body.contact_name || null,
      body.contact_email?.trim() || null,
      body.contact_phone?.trim() || null,
      body.can_send !== undefined ? Boolean(body.can_send) : null,
      body.can_receive !== undefined ? Boolean(body.can_receive) : null,
      body.zelle_handle || null,
      body.venmo_handle || null,
      body.notes || null,
      id,
      req.user.id,
    ]
  );
  if (updated.rowCount === 0) {
    return reply.code(404).send({ message: "Contact not found" });
  }
  return updated.rows[0];
});

app.delete("/api/contacts/:id", async (req, reply) => {
  const { id } = req.params;
  const res = await db(
    `DELETE FROM contacts WHERE id=$1 AND owner_id=$2`,
    [id, req.user.id]
  );
  if (res.rowCount === 0) {
    return reply.code(404).send({ message: "Contact not found" });
  }
  return { ok: true };
});

app.get("/api/contacts/:id/insights", async (req, reply) => {
  const { id } = req.params;
  const contactRes = await db(
    `SELECT * FROM contacts WHERE id=$1 AND owner_id=$2`,
    [id, req.user.id]
  );
  if (contactRes.rowCount === 0) {
    return reply.code(404).send({ message: "Contact not found" });
  }
  const contact = contactRes.rows[0];
  if (!contact.contact_email) {
    return { contact, shared_groups: [], recent_transactions: [] };
  }

  const sharedGroups = await db(
    `SELECT g.id, g.name
     FROM group_members gm
     JOIN groups g ON g.id = gm.group_id
     WHERE LOWER(gm.email)=LOWER($1)
       AND EXISTS (
         SELECT 1 FROM group_members gm2
         WHERE gm2.group_id = gm.group_id AND LOWER(gm2.email)=LOWER($2)
       )
     ORDER BY g.name`,
    [contact.contact_email, req.user.email]
  );

  const recent = await db(
    `SELECT t.id, t.description, t.amount_cents, t.created_at, g.name AS group_name
     FROM transactions t
     JOIN groups g ON g.id = t.group_id
     WHERE LOWER(t.created_by)=LOWER($1)
     ORDER BY t.created_at DESC
     LIMIT 5`,
    [contact.contact_email]
  );

  return {
    contact,
    shared_groups: sharedGroups.rows,
    recent_transactions: recent.rows,
  };
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
  const r = await db(
    `SELECT language, theme, color_blind_mode, text_scale, haptic_feedback, audio_assist, notifications_enabled
     FROM settings WHERE user_id=$1`,
    [req.user.id]
  );
  return r.rows[0] || {};
});

app.put("/api/settings", async (req) => {
  const {
    language = "en",
    theme = "light",
    color_blind_mode = false,
    text_scale = 100,
    haptic_feedback = false,
    audio_assist = false,
    notifications_enabled = true,
  } = req.body || {};

  await db(
    `INSERT INTO settings
       (user_id, language, theme, color_blind_mode, text_scale, haptic_feedback, audio_assist, notifications_enabled)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (user_id)
     DO UPDATE SET
       language=EXCLUDED.language,
       theme=EXCLUDED.theme,
       color_blind_mode=EXCLUDED.color_blind_mode,
       text_scale=EXCLUDED.text_scale,
       haptic_feedback=EXCLUDED.haptic_feedback,
       audio_assist=EXCLUDED.audio_assist,
       notifications_enabled=EXCLUDED.notifications_enabled`,
    [
      req.user.id,
      language,
      theme,
      Boolean(color_blind_mode),
      Number(text_scale),
      Boolean(haptic_feedback),
      Boolean(audio_assist),
      Boolean(notifications_enabled),
    ]
  );

  return { ok: true };
});

/* ---------- Error Handler ---------- */
app.setErrorHandler((err, req, reply) => {
  if (err instanceof ApiError) {
    reply.code(err.statusCode).send({ message: err.message });
    return;
  }
  if (err.statusCode && err.message) {
    reply.code(err.statusCode).send({ message: err.message });
    return;
  }
  console.error("💥 Server Error:", err);
  reply
    .code(500)
    .send({ message: "Internal Server Error", error: err.message });
});

/* ---------- Start Server ---------- */
app
  .listen({ port: Number(PORT), host: "0.0.0.0" })
  .then(() =>
    console.log(`🚀 Swallet Pro API running on http://localhost:${PORT}`)
  )
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
