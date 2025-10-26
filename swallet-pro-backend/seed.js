// seed.js — populate Swallet Pro Neon DB with opinionated demo data
import "dotenv/config";
import pkg from "pg";

const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const toCents = (value) => Math.round(Number(value) * 100);

async function seed() {
  console.log("🌱 Seeding Swallet Pro Database...");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    /* -------------------- USERS -------------------- */
    const people = [
      { email: "owner@swallet.com", name: "Owner" },
      { email: "admin@swallet.com", name: "Admin User" },
      { email: "viewer@swallet.com", name: "Viewer User" },
    ];

    const userMap = {};
    for (const person of people) {
      const res = await client.query(
        `INSERT INTO users (email, display_name)
         VALUES ($1,$2)
         ON CONFLICT (email)
         DO UPDATE SET display_name=EXCLUDED.display_name
         RETURNING id`,
        [person.email, person.name]
      );
      userMap[person.email] = res.rows[0].id;
    }

    const sampleUserIds = Object.values(userMap);

    /* -------------------- CLEANUP EXISTING SAMPLE DATA -------------------- */
    const sampleGroups = ["Project Alpha", "Weekend Trip"];
    const groupIdRes = await client.query(
      `SELECT id FROM groups WHERE name = ANY($1)`,
      [sampleGroups]
    );
    if (groupIdRes.rowCount > 0) {
      const groupIds = groupIdRes.rows.map((g) => g.id);
      await client.query(
        `DELETE FROM approvals WHERE transaction_id IN (
           SELECT id FROM transactions WHERE group_id = ANY($1::uuid[])
         )`,
        [groupIds]
      );
      await client.query(
        `DELETE FROM comments WHERE transaction_id IN (
           SELECT id FROM transactions WHERE group_id = ANY($1::uuid[])
         )`,
        [groupIds]
      );
      await client.query(
        `DELETE FROM transactions WHERE group_id = ANY($1::uuid[])`,
        [groupIds]
      );
      await client.query(
        `DELETE FROM group_members WHERE group_id = ANY($1::uuid[])`,
        [groupIds]
      );
      await client.query(
        `DELETE FROM group_configs WHERE group_id = ANY($1::uuid[])`,
        [groupIds]
      );
      await client.query(`DELETE FROM groups WHERE id = ANY($1::uuid[])`, [
        groupIds,
      ]);
    }

    if (sampleUserIds.length) {
      await client.query(
        `DELETE FROM accounts WHERE user_id = ANY($1::uuid[])`,
        [sampleUserIds]
      );
      await client.query(
        `DELETE FROM contacts WHERE owner_id = ANY($1::uuid[])`,
        [sampleUserIds]
      );
      await client.query(
        `DELETE FROM notifications WHERE user_id = ANY($1::uuid[])`,
        [sampleUserIds]
      );
      await client.query(
        `DELETE FROM settings WHERE user_id = ANY($1::uuid[])`,
        [sampleUserIds]
      );
    }

    /* -------------------- ACCOUNTS -------------------- */
    const accounts = [
      {
        email: "owner@swallet.com",
        name: "Chase Bank",
        type: "checking",
        last4: "7890",
        routing: "021000021",
        balance: 2500,
        available: 500,
        debits: 1200,
        credits: 800,
        isDefault: true,
      },
      {
        email: "owner@swallet.com",
        name: "AmEx Platinum",
        type: "credit",
        last4: "3344",
        routing: null,
        balance: -120,
        available: 1800,
        debits: 600,
        credits: 0,
        isDefault: false,
      },
      {
        email: "admin@swallet.com",
        name: "Bank of America",
        type: "checking",
        last4: "5555",
        routing: "026009593",
        balance: 1700,
        available: 0,
        debits: 400,
        credits: 250,
        isDefault: true,
      },
      {
        email: "viewer@swallet.com",
        name: "Wells Fargo Savings",
        type: "savings",
        last4: "3333",
        routing: "121000248",
        balance: 960,
        available: 0,
        debits: 0,
        credits: 0,
        isDefault: true,
      },
    ];

    const accountMap = {};
    for (const acct of accounts) {
      const res = await client.query(
        `INSERT INTO accounts
           (user_id,institution_name,account_type,account_number_last4,routing_number,currency,
            balance_cents,available_credit_cents,total_debits_cents,total_credits_cents,is_default)
         VALUES ($1,$2,$3,$4,$5,'USD',$6,$7,$8,$9,$10)
         RETURNING id`,
        [
          userMap[acct.email],
          acct.name,
          acct.type,
          acct.last4,
          acct.routing,
          toCents(acct.balance),
          toCents(acct.available),
          toCents(acct.debits),
          toCents(acct.credits),
          acct.isDefault,
        ]
      );
      accountMap[`${acct.email}:${acct.name}`] = res.rows[0].id;
    }

    /* -------------------- GROUPS & CONFIGS -------------------- */
    const groupDefs = [
      {
        name: "Project Alpha",
        currency: "USD",
        purpose: "Startup runway & shared expenses",
        baseAccountKey: "owner@swallet.com:Chase Bank",
        destinationAccountKey: "owner@swallet.com:Chase Bank",
        contribution: 500,
        autoPayDay: 5,
        approvalThreshold: 2,
        spendingLimit: 1200,
      },
      {
        name: "Weekend Trip",
        currency: "USD",
        purpose: "Friends trip to the coast",
        baseAccountKey: "admin@swallet.com:Bank of America",
        destinationAccountKey: "admin@swallet.com:Bank of America",
        contribution: 150,
        autoPayDay: 20,
        approvalThreshold: 1,
        spendingLimit: 600,
      },
    ];

    const groupMap = {};
    for (const def of groupDefs) {
      const res = await client.query(
        `INSERT INTO groups (name,currency)
         VALUES ($1,$2)
         RETURNING id`,
        [def.name, def.currency]
      );
      const groupId = res.rows[0].id;
      groupMap[def.name] = groupId;

      await client.query(
        `INSERT INTO group_configs
           (group_id,purpose,base_account_id,contribution_amount_cents,auto_pay_enabled,auto_pay_day,
            approval_threshold,spending_limit_cents,destination_account_id,rules)
         VALUES ($1,$2,$3,$4,true,$5,$6,$7,$8,$9)
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
          groupId,
          def.purpose,
          accountMap[def.baseAccountKey] || null,
          toCents(def.contribution),
          def.autoPayDay,
          def.approvalThreshold,
          toCents(def.spendingLimit),
          accountMap[def.destinationAccountKey] || null,
          JSON.stringify({ reminder: "email", autoPayGraceDays: 2 }),
        ]
      );
    }

    /* -------------------- MEMBERS -------------------- */
    const memberRows = [
      { group: "Project Alpha", email: "owner@swallet.com", role: "owner" },
      { group: "Project Alpha", email: "admin@swallet.com", role: "admin" },
      { group: "Project Alpha", email: "viewer@swallet.com", role: "viewer" },
      { group: "Weekend Trip", email: "owner@swallet.com", role: "owner" },
      { group: "Weekend Trip", email: "viewer@swallet.com", role: "member" },
    ];

    for (const row of memberRows) {
      await client.query(
        `INSERT INTO group_members (group_id,email,role,display_name,permissions)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (group_id,email) DO UPDATE SET
           role=EXCLUDED.role,
           display_name=COALESCE(EXCLUDED.display_name, group_members.display_name),
           permissions=EXCLUDED.permissions`,
        [
          groupMap[row.group],
          row.email,
          row.role,
          row.email.split("@")[0],
          JSON.stringify({ canApprove: row.role !== "viewer" }),
        ]
      );
    }

    /* -------------------- TRANSACTIONS -------------------- */
    const transactions = [
      {
        group: "Project Alpha",
        type: "collect",
        amount: 500,
        description: "Monthly contribution",
        status: "paid",
        createdBy: "owner@swallet.com",
        accountKey: "owner@swallet.com:Chase Bank",
        dueInDays: 0,
      },
      {
        group: "Project Alpha",
        type: "spend",
        amount: 120,
        description: "Snacks and refreshments",
        status: "pending",
        createdBy: "admin@swallet.com",
        accountKey: "owner@swallet.com:Chase Bank",
        dueInDays: 5,
      },
      {
        group: "Weekend Trip",
        type: "reimburse",
        amount: 220,
        description: "Fuel costs",
        status: "approved",
        createdBy: "viewer@swallet.com",
        accountKey: "admin@swallet.com:Bank of America",
        dueInDays: 7,
      },
    ];

    const txMap = {};
    for (const tx of transactions) {
      const res = await client.query(
        `INSERT INTO transactions
           (group_id,type,amount_cents,description,status,created_by,due_date,account_id,metadata)
         VALUES ($1,$2,$3,$4,$5,$6,NOW() + ($7 || ' days')::interval,$8,$9)
         RETURNING id`,
        [
          groupMap[tx.group],
          tx.type,
          toCents(tx.amount),
          tx.description,
          tx.status,
          tx.createdBy,
          tx.dueInDays,
          accountMap[tx.accountKey] || null,
          JSON.stringify({ category: tx.group === "Project Alpha" ? "Ops" : "Travel" }),
        ]
      );
      txMap[tx.description] = res.rows[0].id;
    }

    /* -------------------- APPROVALS -------------------- */
    await client.query(
      `INSERT INTO approvals (transaction_id, approver_email, decision)
       VALUES ($1,$2,'approve')
       ON CONFLICT (transaction_id, approver_email) DO UPDATE SET decision='approve'`,
      [txMap["Monthly contribution"], "admin@swallet.com"]
    );

    /* -------------------- COMMENTS -------------------- */
    await client.query(
      `INSERT INTO comments (transaction_id, author_id, body)
       VALUES ($1,$2,$3)`,
      [
        txMap["Monthly contribution"],
        userMap["admin@swallet.com"],
        "Looks good to me 👍",
      ]
    );

    /* -------------------- CONTACTS -------------------- */
    await client.query(
      `INSERT INTO contacts
         (owner_id, contact_name, contact_email, contact_phone, can_send, can_receive, notes)
       VALUES
         ($1,'Admin User','admin@swallet.com','555-120-3344',true,true,'Handles operations.'),
         ($1,'Viewer User','viewer@swallet.com',NULL,false,true,'Keeps an eye on expenses.')
       ON CONFLICT (owner_id, contact_email) DO UPDATE SET contact_name=EXCLUDED.contact_name`,
      [userMap["owner@swallet.com"]]
    );

    /* -------------------- NOTIFICATIONS -------------------- */
    await client.query(
      `INSERT INTO notifications
         (user_id,type,title,message,is_read)
       VALUES
         ($1,'payment_paid','Payment received','Project Alpha received a new contribution.',false),
         ($2,'approval_request','Approval needed','Snacks and refreshments pending approval.',false)
       ON CONFLICT DO NOTHING`,
      [userMap["owner@swallet.com"], userMap["admin@swallet.com"]]
    );

    /* -------------------- SETTINGS -------------------- */
    await client.query(
      `INSERT INTO settings
         (user_id, language, theme, color_blind_mode, text_scale, audio_assist)
       VALUES
         ($1,'en','dark',false,100,true),
         ($2,'en','light',false,100,false)
       ON CONFLICT (user_id)
       DO UPDATE SET
         theme=EXCLUDED.theme,
         audio_assist=EXCLUDED.audio_assist`,
      [userMap["owner@swallet.com"], userMap["admin@swallet.com"]]
    );

    await client.query("COMMIT");
    console.log("✅ Seeding complete!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error seeding:", err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();

