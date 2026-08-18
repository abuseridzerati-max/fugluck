import "dotenv/config";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  dotenv.config({ path: "packages/server/.env" });
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — copy packages/server/.env.example to .env and fill it in.");
}

import { sql } from "drizzle-orm";

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });

let schemaEnsured = false;
export async function ensureUserSchema() {
  if (schemaEnsured) return;
  await db.execute(sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified boolean NOT NULL DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamp with time zone;
    ALTER TABLE ledger_entries ALTER COLUMN reason TYPE varchar(128);
    CREATE UNIQUE INDEX IF NOT EXISTS ledger_user_reason_unique ON ledger_entries (user_id, reason);
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id),
      token_hash text NOT NULL UNIQUE,
      expires_at timestamp with time zone NOT NULL,
      created_at timestamp with time zone NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash text NOT NULL UNIQUE,
      expires_at timestamp with time zone NOT NULL,
      created_at timestamp with time zone NOT NULL DEFAULT now()
    );
  `);
  schemaEnsured = true;
}
