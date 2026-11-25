-- Migration 0015: In-Game Coins Knockout Tournaments (Standard brackets only, 0% rake)
-- Preserves strict separation between free virtual COINS and monetary GEL / sandbox / commercial tables.

ALTER TABLE "competition_templates" ALTER COLUMN "currency" TYPE varchar(8);
ALTER TABLE "competition_template_prizes" ALTER COLUMN "currency" TYPE varchar(8);
ALTER TABLE "competition_instances" ALTER COLUMN "currency" TYPE varchar(8);
ALTER TABLE "competition_instance_prizes" ALTER COLUMN "currency" TYPE varchar(8);
--> statement-breakpoint
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'competition_products'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%provenance%'
  LOOP
    EXECUTE format('ALTER TABLE competition_products DROP CONSTRAINT %I', c.conname);
  END LOOP;
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'competition_tournaments'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%provenance%'
  LOOP
    EXECUTE format('ALTER TABLE competition_tournaments DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE "competition_products" ADD CONSTRAINT "competition_products_provenance_check" CHECK (provenance IN ('SANDBOX', 'STAGING_MOCK', 'LIVE', 'COINS'));
ALTER TABLE "competition_products" ADD CONSTRAINT "competition_products_coins_standard_only" CHECK (provenance <> 'COINS' OR (product = 'STANDARD' AND cycle_id IS NULL));
ALTER TABLE "competition_tournaments" ADD CONSTRAINT "competition_tournaments_provenance_check" CHECK (provenance IN ('SANDBOX', 'STAGING_MOCK', 'LIVE', 'COINS'));
ALTER TABLE "competition_tournaments" ADD CONSTRAINT "competition_tournaments_coins_no_cycle" CHECK (provenance <> 'COINS' OR cycle_id IS NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coin_tournament_reservations" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "competition_instance_id" text NOT NULL REFERENCES "competition_instances"("id"),
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "amount_coins" integer NOT NULL CHECK ("amount_coins" >= 0),
  "status" varchar(24) DEFAULT 'RESERVED' NOT NULL CHECK ("status" IN ('RESERVED', 'CAPTURED', 'RELEASED', 'REFUNDED')),
  "idempotency_key" varchar(128) NOT NULL UNIQUE,
  "settlement_key" varchar(128),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  UNIQUE ("competition_instance_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "idx_coin_tourn_res_instance" ON "coin_tournament_reservations" ("competition_instance_id");
CREATE INDEX IF NOT EXISTS "idx_coin_tourn_res_user" ON "coin_tournament_reservations" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coin_tournament_settlements" (
  "competition_instance_id" text PRIMARY KEY NOT NULL REFERENCES "competition_instances"("id"),
  "outcome" varchar(16) NOT NULL CHECK ("outcome" IN ('SETTLED', 'REFUNDED')),
  "winner_user_id" text REFERENCES "users"("id"),
  "total_captured_coins" integer NOT NULL CHECK ("total_captured_coins" >= 0),
  "total_awarded_coins" integer NOT NULL CHECK ("total_awarded_coins" >= 0),
  "idempotency_key" varchar(128) NOT NULL UNIQUE,
  "settled_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
DECLARE browser_role text; target_schema text := current_schema();
BEGIN
  EXECUTE format('REVOKE ALL ON TABLE %I.coin_tournament_reservations FROM PUBLIC', target_schema);
  EXECUTE format('REVOKE ALL ON TABLE %I.coin_tournament_settlements FROM PUBLIC', target_schema);
  FOR browser_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I.coin_tournament_reservations FROM %I', target_schema, browser_role);
    EXECUTE format('REVOKE ALL ON TABLE %I.coin_tournament_settlements FROM %I', target_schema, browser_role);
  END LOOP;
END $$;
