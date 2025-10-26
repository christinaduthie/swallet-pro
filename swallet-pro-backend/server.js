import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Pool } from 'pg';
import * as jose from 'jose';
import bcrypt from 'bcryptjs';

const {
  PORT = 4000,
  DATABASE_URL,
  AUTH0_DOMAIN,
  AUTH0_AUDIENCE,
  MOCK_AUTH = 'true'
} = process.env;

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

/* ---------- Auth (Auth0 or mock) ---------- */
async function verifyAuth0JWT(token) {
  const JWKS = jose.createRemoteJWKSet(
    new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`)
  );
  const { payload } = await jose.jwtVerify(token, JWKS, {
    audience: AUTH0_AUDIENCE,
    issuer: `https://${AUTH0_DOMAIN}/`
  });
  return payload; // sub, email (if scope), etc.
}

// Public routes that should bypass auth hook
const PUBLIC_PATHS = [
  '/api/health',
  '/api/signup',
  '/api/login',
  '/api/public'
];

app.addHook('onRequest', async (req, reply) => {
  if (PUBLIC_PATHS.some(p => req.url.startsWith(p))) return;

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    reply.code(401).send({ message: 'Unauthorized' });
    return;
  }
  const token = auth.slice('Bearer '.length);

  try {
    if (MOCK_AUTH === 'true') {
      // mock format: "fake|email@example.com"
      const parts = token.split('|');
      const email = parts[1] || 'user@example.com';
      const u = await db(
        `INSERT INTO users (email, display_name)
         VALUES ($1,$2)
         ON CONFLICT (email) DO UPDATE SET display_name = COALESCE(users.display_name,$2)
         RETURNING id,email,display_name`,
        [email, email.split('@')[0]]
      );
      req.user = { id: u.rows[0].id, email: u.rows[0].email };
    } else {
      const payload = await verifyAuth0JWT(token);
      const email = payload.email || `${payload.sub}@noemail.local`;
      const sub = payload.sub;
      const u = await db(
        `INSERT INTO users (auth_sub,email,display_name)
         VALUES ($1,$2,$3)
         ON CONFLICT (auth_sub) DO UPDATE SET email=EXCLUDED.email
         RETURNING id,email`,
        [sub, email, email.split('@')[0]]
      );
      req.user = { id: u.rows[0].id, email: u.rows[0].email, sub };
    }
  } catch (e) {
    reply.code(401).send({ message: 'Unauthorized', error: e.message });
  }
});

/* ---------- Public: health ---------- */
app.get('/api/health', async () => {
  await db('SELECT 1');
  return { ok: true };
});

/* ---------- Public: Sign Up (hackathon local auth) ---------- */
app.post('/api/signup', async (req, reply) => {
  const { email, password, display_name } = req.body || {};
  if (!email || !password) {
    return reply.code(400).send({ message: 'email and password required' });
  }

  const exists = await db(`SELECT id FROM users WHERE email=$1`, [email]);
  if (exists.rowCount > 0) {
    return reply.code(409).send({ message: 'account already exists' });
  }

  const hash = await bcrypt.hash(password, 10);
  const u = await db(
    `INSERT INTO users (email, display_name, password_hash)
     VALUES ($1,$2,$3)
     RETURNING id,email,display_name`,
    [email, display_name || email.split('@')[0], hash]
  );

  // return a dev token compatible with the mock auth hook
  return { token: `fake|${u.rows[0].email}` };
});

/* ---------- Public: Login (hackathon local auth) ---------- */
app.post('/api/login', async (req, reply) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return reply.code(400).send({ message: 'email and password required' });
  }

  const r = await db(`SELECT id,email,password_hash FROM users WHERE email=$1`, [email]);
  if (r.rowCount === 0) {
    // allow quickstart: auto-create user without password (dev only)
    await db(
      `INSERT INTO users (email, display_name)
       VALUES ($1,$2)
       ON CONFLICT (email) DO NOTHING`,
      [email, email.split('@')[0]]
    );
    return { token: `fake|${email}` };
  }

  const { password_hash } = r.rows[0];
  if (!password_hash) {
    // legacy user without password: accept for dev
    return { token: `fake|${email}` };
  }

  const ok = await bcrypt.compare(password, password_hash);
  if (!ok) return reply.code(401).send({ message: 'invalid credentials' });

  return { token: `fake|${email}` };
});

/* ---------- Groups ---------- */
app.get('/api/groups', async () => {
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

app.post('/api/groups', async (req, reply) => {
  const { name, currency = 'USD' } = req.body || {};
  if (!name) return reply.code(400).send({ message: 'name required' });

  const g = await db(
    `INSERT INTO groups (name,currency) VALUES ($1,$2) RETURNING id,name,currency`,
    [name, currency]
  );
  const gid = g.rows[0].id;

  await db(
    `INSERT INTO group_members (group_id,user_id,role)
     VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING`,
    [gid, req.user.id]
  );

  return g.rows[0];
});

app.get('/api/groups/:id', async (req, reply) => {
  const { id } = req.params;
  const g = await db(`SELECT id,name,currency,created_at FROM groups WHERE id=$1`, [id]);
  if (g.rowCount === 0) return reply.code(404).send({ message: 'not found' });
  const m = await db(
    `SELECT gm.user_id as id, u.email, gm.role
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id=$1`,
    [id]
  );
  return { ...g.rows[0], members: m.rows };
});

app.post('/api/groups/:id/members', async (req, reply) => {
  const { id } = req.params;
  const { email, role = 'member' } = req.body || {};
  if (!email) return reply.code(400).send({ message: 'email required' });

  const u = await db(
    `INSERT INTO users (email, display_name)
     VALUES ($1,$2)
     ON CONFLICT (email) DO UPDATE SET display_name = COALESCE(users.display_name,$2)
     RETURNING id`,
    [email, email.split('@')[0]]
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
app.get('/api/groups/:id/ledger', async (req, reply) => {
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

app.post('/api/transactions', async (req, reply) => {
  const { group_id, type, amount_cents, description } = req.body || {};
  if (!group_id || !type || !amount_cents) {
    return reply.code(400).send({ message: 'group_id, type, amount_cents required' });
  }

  const mem = await db(
    `SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2`,
    [group_id, req.user.id]
  );
  if (mem.rowCount === 0) return reply.code(403).send({ message: 'not a member' });

  const r = await db(
    `INSERT INTO transactions (group_id,type,amount_cents,description,status,created_by)
     VALUES ($1,$2,$3,$4,'pending',$5) RETURNING id`,
    [group_id, type, amount_cents, description || null, req.user.id]
  );
  return { id: r.rows[0].id };
});

/* ---------- Approvals ---------- */
app.post('/api/approvals/:txId', async (req, reply) => {
  const { txId } = req.params;
  const { decision } = req.body || {};
  if (!['approve', 'reject'].includes(decision)) {
    return reply.code(400).send({ message: 'decision must be approve|reject' });
  }

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
  const rejects  = Number(r.rows[0].rejects  || 0);

  if (rejects > 0) {
    await db(`UPDATE transactions SET status='rejected' WHERE id=$1`, [txId]);
  } else if (approves >= 2) {
    await db(`UPDATE transactions SET status='paid' WHERE id=$1`, [txId]);
  } else {
    await db(`UPDATE transactions SET status='approved' WHERE id=$1`, [txId]);
  }

  return { ok: true, approves, rejects };
});

/* ---------- Comments (optional) ---------- */
app.get('/api/transactions/:id/comments', async (req) => {
  const { id } = req.params;
  const r = await db(
    `SELECT c.id, c.body, c.created_at, u.email AS author
     FROM comments c JOIN users u ON u.id = c.author_id
     WHERE c.transaction_id=$1 ORDER BY c.created_at ASC`,
    [id]
  );
  return r.rows;
});

app.post('/api/transactions/:id/comments', async (req, reply) => {
  const { id } = req.params;
  const { body } = req.body || {};
  if (!body) return reply.code(400).send({ message: 'body required' });
  await db(
    `INSERT INTO comments (transaction_id, author_id, body)
     VALUES ($1,$2,$3)`,
    [id, req.user.id, body]
  );
  return { ok: true };
});

/* ---------- start ---------- */
app.listen({ port: Number(PORT), host: '0.0.0.0' })
  .then(() => console.log(`API on http://localhost:${PORT}`))
  .catch((e) => { console.error(e); process.exit(1); });
