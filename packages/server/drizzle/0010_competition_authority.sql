CREATE TABLE IF NOT EXISTS competition_authority_runs (
 id text PRIMARY KEY,
 instance_id text NOT NULL UNIQUE REFERENCES competition_instances(id),
 match_id text NOT NULL UNIQUE REFERENCES matches_history(id),
 game_id text NOT NULL, version text NOT NULL, seed integer NOT NULL,
 owner_id text NOT NULL, fence integer NOT NULL DEFAULT 1,
 lease_until timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED','READY','ACTIVE','COMPLETED','VOIDED')),
 start_at timestamptz, deadline timestamptz, terminal_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE competition_authority_runs ADD COLUMN IF NOT EXISTS cap_ticks integer NOT NULL DEFAULT 10800 CHECK(cap_ticks>0);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS competition_authority_sessions (
 id text PRIMARY KEY, run_id text NOT NULL REFERENCES competition_authority_runs(id),
 user_id text NOT NULL REFERENCES users(id),
 controller_id text, epoch integer NOT NULL DEFAULT 0, nonce_hash text,
 status text NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED','READY','ACTIVE','COMPLETED','FORFEITED','VOIDED','EXPIRED')),
 terminal_at timestamptz,
 UNIQUE(run_id,user_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS competition_authority_results (
 id text PRIMARY KEY, session_id text NOT NULL UNIQUE REFERENCES competition_authority_sessions(id),
 score integer NOT NULL CHECK(score >= 0), ticks integer NOT NULL CHECK(ticks >= 0),
 reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS competition_authority_decisions (
 run_id text PRIMARY KEY REFERENCES competition_authority_runs(id),
 kind text NOT NULL CHECK(kind IN ('WIN','DRAW','VOID','FORFEIT')),
 winner_user_id text REFERENCES users(id), reason text NOT NULL,
 result_ids jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(), applied_at timestamptz,
 CHECK ((kind IN ('WIN','FORFEIT') AND winner_user_id IS NOT NULL) OR (kind IN ('VOID','DRAW') AND winner_user_id IS NULL))
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_authority_result() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Authoritative results are immutable'; END $$;
--> statement-breakpoint
CREATE OR REPLACE TRIGGER authority_result_immutable BEFORE UPDATE ON competition_authority_results
FOR EACH ROW EXECUTE FUNCTION protect_authority_result();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_authority_decision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW) - 'applied_at') IS DISTINCT FROM (to_jsonb(OLD) - 'applied_at')
 OR (OLD.applied_at IS NOT NULL AND NEW.applied_at IS DISTINCT FROM OLD.applied_at)
 THEN RAISE EXCEPTION 'Terminal decision is immutable'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE TRIGGER authority_decision_immutable BEFORE UPDATE ON competition_authority_decisions
FOR EACH ROW EXECUTE FUNCTION protect_authority_decision();
