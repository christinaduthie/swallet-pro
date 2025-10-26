// seed.js — populate Swallet Pro Neon DB with demo data
import "dotenv/config";
import pkg from "pg";

const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function seed() {
  console.log("🌱 Seeding Swallet Pro Database...");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    /* -------------------- USERS -------------------- */
    await client.query(`
      INSERT INTO users (id, email, display_name)
      VALUES
        (gen_random_uuid(), 'owner@swallet.com', 'Owner'),
        (gen_random_uuid(), 'admin@swallet.com', 'Admin User'),
        (gen_random_uuid(), 'viewer@swallet.com', 'Viewer User')
      ON CONFLICT (email) DO NOTHING;
    `);

    /* -------------------- GROUPS -------------------- */
    await client.query(`
      INSERT INTO groups (id, name, currency, created_at)
      VALUES
        (gen_random_uuid(), 'Project Alpha', 'USD', NOW()),
        (gen_random_uuid(), 'Weekend Trip', 'USD', NOW())
      ON CONFLICT DO NOTHING;
    `);

    /* -------------------- MEMBERS -------------------- */
    await client.query(`
      INSERT INTO group_members (id, group_id, user_id, role)
      SELECT gen_random_uuid(), g.id, u.id, 'owner'
      FROM groups g, users u
      WHERE g.name='Project Alpha' AND u.email='owner@swallet.com'
      ON CONFLICT DO NOTHING;

      INSERT INTO group_members (id, group_id, user_id, role)
      SELECT gen_random_uuid(), g.id, u.id, 'admin'
      FROM groups g, users u
      WHERE g.name='Project Alpha' AND u.email='admin@swallet.com'
      ON CONFLICT DO NOTHING;

      INSERT INTO group_members (id, group_id, user_id, role)
      SELECT gen_random_uuid(), g.id, u.id, 'viewer'
      FROM groups g, users u
      WHERE g.name='Weekend Trip' AND u.email='viewer@swallet.com'
      ON CONFLICT DO NOTHING;
    `);

    /* -------------------- TRANSACTIONS -------------------- */
    await client.query(`
      INSERT INTO transactions (id, group_id, type, amount_cents, description, status, created_by, created_at)
      SELECT gen_random_uuid(), g.id, 'collect', 5000, 'Monthly contribution', 'paid', u.id, NOW()
      FROM groups g, users u
      WHERE g.name='Project Alpha' AND u.email='owner@swallet.com'
      UNION ALL
      SELECT gen_random_uuid(), g.id, 'spend', 1200, 'Snacks and refreshments', 'pending', u.id, NOW()
      FROM groups g, users u
      WHERE g.name='Project Alpha' AND u.email='admin@swallet.com'
      UNION ALL
      SELECT gen_random_uuid(), g.id, 'reimburse', 2200, 'Fuel costs', 'rejected', u.id, NOW()
      FROM groups g, users u
      WHERE g.name='Weekend Trip' AND u.email='viewer@swallet.com';
    `);

    /* -------------------- APPROVALS -------------------- */
    await client.query(`
      INSERT INTO approvals (id, transaction_id, approver_id, decision)
      SELECT gen_random_uuid(), t.id, u.id, 'approve'
      FROM transactions t, users u
      WHERE t.description='Monthly contribution' AND u.email='admin@swallet.com'
      ON CONFLICT DO NOTHING;
    `);

    /* -------------------- COMMENTS -------------------- */
    await client.query(`
      INSERT INTO comments (id, transaction_id, author_id, body, created_at)
      SELECT gen_random_uuid(), t.id, u.id, 'Looks good to me 👍', NOW()
      FROM transactions t, users u
      WHERE t.description='Monthly contribution' AND u.email='admin@swallet.com';
    `);

    /* -------------------- ACCOUNTS -------------------- */
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        bank_name TEXT,
        account_number TEXT,
        balance_cents INTEGER DEFAULT 0
      );

      INSERT INTO accounts (user_id, bank_name, account_number, balance_cents)
      SELECT id, 'Chase Bank', 'XXXX-7890', 250000 FROM users WHERE email='owner@swallet.com'
      UNION ALL
      SELECT id, 'Bank of America', 'XXXX-5555', 170000 FROM users WHERE email='admin@swallet.com'
      UNION ALL
      SELECT id, 'Wells Fargo', 'XXXX-3333', 96000 FROM users WHERE email='viewer@swallet.com';
    `);

    /* -------------------- CONTACTS -------------------- */
    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
        contact_name TEXT,
        contact_email TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      INSERT INTO contacts (owner_id, contact_name, contact_email)
      SELECT id, 'Admin User', 'admin@swallet.com' FROM users WHERE email='owner@swallet.com'
      UNION ALL
      SELECT id, 'Viewer User', 'viewer@swallet.com' FROM users WHERE email='owner@swallet.com';
    `);

    /* -------------------- NOTIFICATIONS -------------------- */
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        message TEXT,
        type TEXT DEFAULT 'info',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      INSERT INTO notifications (user_id, message, type)
      SELECT id, 'Your group Project Alpha received a new payment.', 'success' FROM users WHERE email='owner@swallet.com'
      UNION ALL
      SELECT id, 'Transaction pending approval: Snacks and refreshments', 'warning' FROM users WHERE email='admin@swallet.com';
    `);

    /* -------------------- SETTINGS -------------------- */
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        language TEXT DEFAULT 'en',
        theme TEXT DEFAULT 'light',
        audio_assist BOOLEAN DEFAULT false
      );

      INSERT INTO settings (user_id, language, theme, audio_assist)
      SELECT id, 'en', 'dark', true FROM users
      ON CONFLICT (user_id) DO NOTHING;
    `);

    await client.query("COMMIT");
    console.log("✅ Seeding complete!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error seeding:", err.message);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
