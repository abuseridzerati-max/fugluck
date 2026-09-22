-- Migration 0009: Sandbox Accounting Phase 2
-- Implements FUGLUCK — FINAL COMPETITION DOMAIN CONTRACT
-- Creates: sandbox_entry_reservations, sandbox_ledger_entries, sandbox_settlements
-- Enforces: overdraft prevention trigger on sandbox available and reserved balances

CREATE TABLE IF NOT EXISTS "sandbox_entry_reservations" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"competition_instance_id" text NOT NULL,
	"user_id" text NOT NULL,
	"currency" varchar(3) DEFAULT 'GEL' NOT NULL,
	"amount_minor" integer NOT NULL,
	"status" varchar(24) DEFAULT 'RESERVED' NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"accounting_reference_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sandbox_res_amount_check" CHECK (amount_minor >= 0),
	CONSTRAINT "sandbox_res_status_check" CHECK (status in ('RESERVED', 'CAPTURED', 'RELEASED', 'REFUNDED'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sandbox_entry_reservations" ADD CONSTRAINT "sandbox_res_comp_instance_id_fk" FOREIGN KEY ("competition_instance_id") REFERENCES "public"."competition_instances"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sandbox_entry_reservations" ADD CONSTRAINT "sandbox_res_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_sandbox_res_instance_user" ON "sandbox_entry_reservations" ("competition_instance_id", "user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_sandbox_res_idempotency" ON "sandbox_entry_reservations" ("idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sandbox_res_user_status" ON "sandbox_entry_reservations" ("user_id", "status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sandbox_ledger_entries" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"accounting_reference_id" varchar(64) NOT NULL,
	"idempotency_key" varchar(128),
	"competition_instance_id" text,
	"user_id" text,
	"account_id" varchar(64) NOT NULL,
	"event_type" varchar(32) NOT NULL,
	"currency" varchar(3) DEFAULT 'GEL' NOT NULL,
	"amount_minor" integer NOT NULL,
	"balance_type" varchar(16) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sandbox_ledger_balance_type_check" CHECK (balance_type in ('AVAILABLE', 'RESERVED', 'CAPTURED', 'SETTLED'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sandbox_ledger_entries" ADD CONSTRAINT "sandbox_ledger_comp_instance_id_fk" FOREIGN KEY ("competition_instance_id") REFERENCES "public"."competition_instances"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sandbox_ledger_entries" ADD CONSTRAINT "sandbox_ledger_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sandbox_ledger_account" ON "sandbox_ledger_entries" ("account_id", "balance_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sandbox_ledger_ref" ON "sandbox_ledger_entries" ("accounting_reference_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sandbox_ledger_inst" ON "sandbox_ledger_entries" ("competition_instance_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sandbox_ledger_user" ON "sandbox_ledger_entries" ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_sandbox_ledger_idempotency" ON "sandbox_ledger_entries" ("idempotency_key") WHERE "idempotency_key" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sandbox_settlements" (
	"competition_instance_id" text PRIMARY KEY NOT NULL,
	"status" varchar(16) NOT NULL,
	"total_entries_captured_minor" integer NOT NULL,
	"total_prizes_awarded_minor" integer NOT NULL,
	"platform_margin_minor" integer DEFAULT 0 NOT NULL,
	"promotional_subsidy_minor" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'GEL' NOT NULL,
	"accounting_reference_id" varchar(64) NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"settled_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sandbox_settlements_status_check" CHECK (status in ('SETTLED', 'REFUNDED', 'VOIDED')),
	CONSTRAINT "sandbox_settlements_entries_check" CHECK (total_entries_captured_minor >= 0),
	CONSTRAINT "sandbox_settlements_prizes_check" CHECK (total_prizes_awarded_minor >= 0),
	CONSTRAINT "sandbox_settlements_margin_check" CHECK (platform_margin_minor >= 0),
	CONSTRAINT "sandbox_settlements_subsidy_check" CHECK (promotional_subsidy_minor >= 0)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sandbox_settlements" ADD CONSTRAINT "sandbox_settlements_comp_instance_id_fk" FOREIGN KEY ("competition_instance_id") REFERENCES "public"."competition_instances"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_sandbox_settlements_idempotency" ON "sandbox_settlements" ("idempotency_key");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_non_negative_sandbox_balance()
RETURNS trigger AS $$
DECLARE
  current_available integer;
  current_reserved integer;
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.currency = 'GEL' THEN
    SELECT
      COALESCE(SUM(CASE WHEN balance_type = 'AVAILABLE' THEN amount_minor ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN balance_type = 'RESERVED' THEN amount_minor ELSE 0 END), 0)
    INTO current_available, current_reserved
    FROM sandbox_ledger_entries
    WHERE user_id = NEW.user_id AND currency = 'GEL';

    IF current_available < 0 THEN
      RAISE EXCEPTION 'Sandbox balance overdraft: available funds cannot be negative for user % (got %)', NEW.user_id, current_available;
    END IF;

    IF current_reserved < 0 THEN
      RAISE EXCEPTION 'Sandbox balance overdraft: reserved funds cannot be negative for user % (got %)', NEW.user_id, current_reserved;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS sandbox_balance_non_negative_guard ON sandbox_ledger_entries;
--> statement-breakpoint
CREATE TRIGGER sandbox_balance_non_negative_guard
  AFTER INSERT ON sandbox_ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION enforce_non_negative_sandbox_balance();
