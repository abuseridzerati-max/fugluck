import dotenv from "dotenv";
dotenv.config({ path: "packages/server/.env" });
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "dev_secret_for_standalone_test_verification_32bytes";

import { eq, sql } from "drizzle-orm";
import { hashPassword } from "../packages/server/src/auth/password.ts";
import { db } from "../packages/server/src/db/client.ts";
import { users } from "../packages/server/src/db/schema.ts";

async function main() {
  // Ensure schema migrations exist on PostgreSQL table
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role varchar(20) NOT NULL DEFAULT 'user';`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS status varchar(16) NOT NULL DEFAULT 'active';`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS status_reason text;`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id text PRIMARY KEY,
      admin_user_id text NOT NULL REFERENCES users(id),
      action varchar(64) NOT NULL,
      target_type varchar(32) NOT NULL DEFAULT 'system',
      target_id text,
      amount integer,
      currency varchar(16),
      reason text NOT NULL DEFAULT 'No reason provided',
      idempotency_key text UNIQUE,
      details jsonb,
      created_at timestamp with time zone NOT NULL DEFAULT NOW()
    );
  `);
  const adminUsername = "admin";
  const adminPassword = "admin12345";

  const existing = await db.query.users.findFirst({ where: eq(users.username, adminUsername) });

  if (existing) {
    await db.update(users).set({ role: "SUPER_ADMIN", status: "active" }).where(eq(users.id, existing.id));
    console.log(`\nExisting user [${adminUsername}] updated to SUPER_ADMIN role.`);
  } else {
    const passwordHash = await hashPassword(adminPassword);
    await db.insert(users).values({
      id: "usr_admin_default",
      username: adminUsername,
      email: "admin@arcadeclash.com",
      passwordHash,
      role: "SUPER_ADMIN",
      status: "active",
    });
    console.log(`\nCreated new default administrator account [${adminUsername}].`);
  }

  console.log("\nADMINISTRATOR LOGIN CREDENTIALS:");
  console.log(`  Username: ${adminUsername}`);
  console.log(`  Password: ${adminPassword}`);
  console.log(`  Role:     SUPER_ADMIN\n`);
}

main().catch((err) => {
  console.error("Failed to seed admin user:", err);
  process.exit(1);
});
