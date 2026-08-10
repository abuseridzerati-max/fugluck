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

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });
