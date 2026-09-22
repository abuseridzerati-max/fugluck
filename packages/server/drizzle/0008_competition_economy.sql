-- Migration 0008: Competition Economy Phase 1
-- Implements FUGLUCK — FINAL COMPETITION DOMAIN CONTRACT
-- Creates: competition_templates, competition_template_prizes, competition_instances, competition_instance_prizes, competition_participants
-- Updates: currency check constraints on matches_history and match_settlements to support 'GEL' while preserving historical 'COINS' and 'DIAMONDS'
-- Adds: competition_instance_id to matches_history

CREATE TABLE IF NOT EXISTS "competition_templates" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"title" varchar(128) NOT NULL,
	"format" varchar(32) DEFAULT 'HEAD_TO_HEAD' NOT NULL,
	"participant_capacity" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'GEL' NOT NULL,
	"entry_fee_minor" integer NOT NULL,
	"rules_version" varchar(32) NOT NULL,
	"skill_assessment_version" varchar(32) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"jurisdiction" varchar(8) DEFAULT 'GE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comp_templates_fee_check" CHECK (entry_fee_minor >= 0),
	CONSTRAINT "comp_templates_cap_check" CHECK (participant_capacity >= 2)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comp_templates_game" ON "competition_templates" ("game_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comp_templates_enabled" ON "competition_templates" ("enabled");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "competition_template_prizes" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" varchar(64) NOT NULL,
	"placement" integer NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'GEL' NOT NULL,
	CONSTRAINT "tmpl_prizes_amount_check" CHECK (amount_minor >= 0),
	CONSTRAINT "tmpl_prizes_placement_check" CHECK (placement >= 1)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "competition_template_prizes" ADD CONSTRAINT "comp_tmpl_prizes_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."competition_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tmpl_prizes_template_place" ON "competition_template_prizes" ("template_id", "placement");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "competition_instances" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" varchar(64) NOT NULL,
	"game_id" text NOT NULL,
	"format" varchar(32) NOT NULL,
	"participant_capacity" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"entry_fee_minor" integer NOT NULL,
	"rules_version" varchar(32) NOT NULL,
	"skill_assessment_version" varchar(32) NOT NULL,
	"jurisdiction" varchar(8) NOT NULL,
	"status" varchar(24) DEFAULT 'PENDING_ENTRANTS' NOT NULL,
	"current_participants" integer DEFAULT 0 NOT NULL,
	"match_id" text,
	"winner_user_id" text,
	"locked_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comp_instances_cap_check" CHECK (current_participants <= participant_capacity),
	CONSTRAINT "comp_instances_fee_check" CHECK (entry_fee_minor >= 0)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "competition_instances" ADD CONSTRAINT "comp_instances_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."competition_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "competition_instances" ADD CONSTRAINT "comp_instances_winner_user_id_fk" FOREIGN KEY ("winner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comp_instances_template" ON "competition_instances" ("template_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comp_instances_status" ON "competition_instances" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "competition_instance_prizes" (
	"id" text PRIMARY KEY NOT NULL,
	"instance_id" text NOT NULL,
	"placement" integer NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"awarded_user_id" text,
	CONSTRAINT "inst_prizes_amount_check" CHECK (amount_minor >= 0),
	CONSTRAINT "inst_prizes_placement_check" CHECK (placement >= 1)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "competition_instance_prizes" ADD CONSTRAINT "comp_inst_prizes_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."competition_instances"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "competition_instance_prizes" ADD CONSTRAINT "comp_inst_prizes_awarded_user_id_fk" FOREIGN KEY ("awarded_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_inst_prizes_instance_place" ON "competition_instance_prizes" ("instance_id", "placement");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "competition_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"instance_id" text NOT NULL,
	"user_id" text NOT NULL,
	"seat_index" integer NOT NULL,
	"entry_fee_minor" integer NOT NULL,
	"score" integer,
	"rank" integer,
	"prize_won_minor" integer DEFAULT 0 NOT NULL,
	"status" varchar(16) DEFAULT 'REGISTERED' NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comp_part_seat_check" CHECK (seat_index >= 0),
	CONSTRAINT "comp_part_fee_check" CHECK (entry_fee_minor >= 0),
	CONSTRAINT "comp_part_prize_check" CHECK (prize_won_minor >= 0)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "competition_participants" ADD CONSTRAINT "comp_participants_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."competition_instances"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "competition_participants" ADD CONSTRAINT "comp_participants_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_comp_part_instance_user" ON "competition_participants" ("instance_id", "user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_comp_part_instance_seat" ON "competition_participants" ("instance_id", "seat_index");
--> statement-breakpoint
ALTER TABLE "matches_history" ADD COLUMN IF NOT EXISTS "competition_instance_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_matches_competition_instance" ON "matches_history" ("competition_instance_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matches_history" ADD CONSTRAINT "matches_history_comp_instance_id_fk" FOREIGN KEY ("competition_instance_id") REFERENCES "public"."competition_instances"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "matches_history" DROP CONSTRAINT IF EXISTS "matches_history_currency_check";
--> statement-breakpoint
ALTER TABLE "matches_history" ADD CONSTRAINT "matches_history_currency_check" CHECK (currency IN ('COINS', 'DIAMONDS', 'GEL'));
--> statement-breakpoint
ALTER TABLE "match_settlements" DROP CONSTRAINT IF EXISTS "match_settlements_currency_check";
--> statement-breakpoint
ALTER TABLE "match_settlements" ADD CONSTRAINT "match_settlements_currency_check" CHECK (currency IN ('COINS', 'DIAMONDS', 'GEL'));
