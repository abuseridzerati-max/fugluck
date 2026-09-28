CREATE TABLE IF NOT EXISTS competition_product_configs (
 game_id text NOT NULL, revision integer NOT NULL CHECK(revision>0), config jsonb NOT NULL,
 active boolean NOT NULL DEFAULT true, actor_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(game_id,revision), CHECK(game_id IN ('space-blaster','cyber-hopper'))
);
CREATE UNIQUE INDEX IF NOT EXISTS competition_product_active_config ON competition_product_configs(game_id) WHERE active;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS competition_special_cycles (
 id text PRIMARY KEY, game_id text NOT NULL, product text NOT NULL CHECK(product IN ('PROMO','GIFT')),
 opens_at timestamptz NOT NULL, cutoff_at timestamptz NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 timezone text NOT NULL, terms jsonb NOT NULL,
 CHECK(opens_at<=cutoff_at AND cutoff_at<=starts_at AND starts_at<ends_at), UNIQUE(game_id,product,starts_at)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS competition_products (
 template_id varchar(64) PRIMARY KEY REFERENCES competition_templates(id), game_id text NOT NULL,
 product text NOT NULL CHECK(product IN ('STANDARD','PROMO','GIFT')),
 terms jsonb NOT NULL, cycle_id text UNIQUE REFERENCES competition_special_cycles(id),
 provenance text NOT NULL CHECK(provenance IN ('SANDBOX','STAGING_MOCK','LIVE')),
 CHECK((product='STANDARD' AND cycle_id IS NULL) OR (product<>'STANDARD' AND cycle_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS competition_tournaments (
 instance_id text PRIMARY KEY REFERENCES competition_instances(id), terms jsonb NOT NULL,
 cycle_id text UNIQUE REFERENCES competition_special_cycles(id), provenance text NOT NULL CHECK(provenance IN ('SANDBOX','STAGING_MOCK','LIVE')),
 state text NOT NULL DEFAULT 'WAITING' CHECK(state IN ('WAITING','CAPTURING','PLAYING','FINALIZING','SETTLED','REFUNDING','VOIDED','CANCELLED')),
 seed text, seeded_order jsonb, seed_commitment text, final_run_id text,
 winner_user_id text REFERENCES users(id), void_reason text, cancellation_actor_id text REFERENCES users(id), invalidated boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), captured_at timestamptz, completed_at timestamptz, completion_processed_at timestamptz,
 CHECK((seed IS NULL AND seeded_order IS NULL AND seed_commitment IS NULL) OR
 (seed IS NOT NULL AND seeded_order IS NOT NULL AND seed_commitment IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS competition_bracket_matches (
 id text PRIMARY KEY, instance_id text NOT NULL REFERENCES competition_tournaments(instance_id),
 round integer NOT NULL CHECK(round BETWEEN 1 AND 4), position integer NOT NULL CHECK(position BETWEEN 0 AND 7),
 player1_id text REFERENCES users(id), player2_id text REFERENCES users(id), winner_user_id text REFERENCES users(id),
 state text NOT NULL CHECK(state IN ('WAITING','READY','ACTIVE','COMPLETE','VOIDED')),
 attempt integer NOT NULL DEFAULT 0 CHECK(attempt>=0), failures integer NOT NULL DEFAULT 0 CHECK(failures>=0),
 ready_deadline timestamptz, completed_at timestamptz, UNIQUE(instance_id,round,position),
 CHECK(player1_id IS NULL OR player2_id IS NULL OR player1_id<>player2_id),
 CHECK(winner_user_id IS NULL OR winner_user_id=player1_id OR winner_user_id=player2_id)
);
ALTER TABLE competition_tournaments ADD COLUMN IF NOT EXISTS cancellation_actor_id text REFERENCES users(id);
--> statement-breakpoint
ALTER TABLE competition_authority_runs DROP CONSTRAINT IF EXISTS competition_authority_runs_instance_id_key;
ALTER TABLE competition_authority_runs ADD COLUMN IF NOT EXISTS bracket_match_id text REFERENCES competition_bracket_matches(id);
ALTER TABLE competition_authority_runs ADD COLUMN IF NOT EXISTS bracket_attempt integer;
CREATE UNIQUE INDEX IF NOT EXISTS authority_legacy_instance_unique ON competition_authority_runs(instance_id) WHERE bracket_match_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS authority_bracket_attempt_unique ON competition_authority_runs(bracket_match_id,bracket_attempt) WHERE bracket_match_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS authority_bracket_live_unique ON competition_authority_runs(bracket_match_id) WHERE bracket_match_id IS NOT NULL AND terminal_at IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS competition_entry_intents (
 instance_id text NOT NULL REFERENCES competition_tournaments(instance_id), user_id text NOT NULL REFERENCES users(id),
 state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','ACCEPTED','COMPENSATING','REJECTED')),
 ticket_id text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(instance_id,user_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS competition_qualification_events (
 instance_id text NOT NULL REFERENCES competition_tournaments(instance_id), user_id text NOT NULL REFERENCES users(id),
 game_id text NOT NULL, outcome text NOT NULL CHECK(outcome IN ('WIN','LOSS')), completed_at timestamptz NOT NULL,
 applied_at timestamptz, PRIMARY KEY(instance_id,user_id)
);
CREATE TABLE IF NOT EXISTS competition_qualification_tracks (
 user_id text NOT NULL REFERENCES users(id), game_id text NOT NULL, product text NOT NULL CHECK(product IN ('PROMO','GIFT')),
 progress integer NOT NULL DEFAULT 0 CHECK(progress>=0), contributions jsonb NOT NULL DEFAULT '[]', target_cycle_id text REFERENCES competition_special_cycles(id),
 PRIMARY KEY(user_id,game_id,product)
);
CREATE TABLE IF NOT EXISTS competition_qualification_tickets (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), game_id text NOT NULL,
 product text NOT NULL CHECK(product IN ('PROMO','GIFT')), cycle_id text NOT NULL REFERENCES competition_special_cycles(id),
 state text NOT NULL CHECK(state IN ('AVAILABLE','CONSUMED','EXPIRED','REPLACED','REVOKED')),
 qualified_at timestamptz NOT NULL, source_instances jsonb NOT NULL DEFAULT '[]', consumed_at timestamptz, consumed_instance_id text REFERENCES competition_instances(id),
 replaced_by text REFERENCES competition_qualification_tickets(id),
 UNIQUE(user_id,game_id,product,cycle_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS qualification_one_entitlement ON competition_qualification_tickets(user_id,game_id,product) WHERE state IN ('AVAILABLE','CONSUMED');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_tournament_terms() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Competition product evidence is immutable'; END IF;
 IF TG_TABLE_NAME='competition_product_configs' THEN
  IF (to_jsonb(NEW)-'active') IS DISTINCT FROM (to_jsonb(OLD)-'active') THEN RAISE EXCEPTION 'Configuration revision is immutable'; END IF;
 ELSIF TG_TABLE_NAME IN ('competition_products','competition_special_cycles') THEN
  IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN RAISE EXCEPTION 'Frozen product terms are immutable'; END IF;
 ELSIF TG_TABLE_NAME='competition_tournaments' THEN
  IF NEW.instance_id<>OLD.instance_id OR NEW.terms IS DISTINCT FROM OLD.terms OR NEW.cycle_id IS DISTINCT FROM OLD.cycle_id OR NEW.provenance IS DISTINCT FROM OLD.provenance
   OR (OLD.seed IS NOT NULL AND (NEW.seed IS DISTINCT FROM OLD.seed OR NEW.seeded_order IS DISTINCT FROM OLD.seeded_order OR NEW.seed_commitment IS DISTINCT FROM OLD.seed_commitment))
   OR (OLD.winner_user_id IS NOT NULL AND NEW.winner_user_id IS DISTINCT FROM OLD.winner_user_id)
   OR (OLD.final_run_id IS NOT NULL AND NEW.final_run_id IS DISTINCT FROM OLD.final_run_id)
   OR (OLD.state IN ('SETTLED','VOIDED','CANCELLED') AND NEW.state<>OLD.state)
   OR (OLD.invalidated AND NOT NEW.invalidated)
  THEN RAISE EXCEPTION 'Frozen tournament terms/seeding/winner are immutable'; END IF;
 ELSIF TG_TABLE_NAME='competition_bracket_matches' THEN
  IF NEW.id<>OLD.id OR NEW.instance_id<>OLD.instance_id OR NEW.round<>OLD.round OR NEW.position<>OLD.position
   OR (OLD.player1_id IS NOT NULL AND NEW.player1_id IS DISTINCT FROM OLD.player1_id)
   OR (OLD.player2_id IS NOT NULL AND NEW.player2_id IS DISTINCT FROM OLD.player2_id)
   OR (OLD.winner_user_id IS NOT NULL AND NEW.winner_user_id IS DISTINCT FROM OLD.winner_user_id)
   OR (OLD.state='COMPLETE' AND NEW.state<>'COMPLETE')
  THEN RAISE EXCEPTION 'Bracket slots and winners are immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER product_config_immutable BEFORE UPDATE OR DELETE ON competition_product_configs FOR EACH ROW EXECUTE FUNCTION protect_tournament_terms();
CREATE OR REPLACE TRIGGER product_terms_immutable BEFORE UPDATE OR DELETE ON competition_products FOR EACH ROW EXECUTE FUNCTION protect_tournament_terms();
CREATE OR REPLACE TRIGGER cycle_terms_immutable BEFORE UPDATE OR DELETE ON competition_special_cycles FOR EACH ROW EXECUTE FUNCTION protect_tournament_terms();
CREATE OR REPLACE TRIGGER tournament_terms_immutable BEFORE UPDATE OR DELETE ON competition_tournaments FOR EACH ROW EXECUTE FUNCTION protect_tournament_terms();
CREATE OR REPLACE TRIGGER bracket_slots_immutable BEFORE UPDATE OR DELETE ON competition_bracket_matches FOR EACH ROW EXECUTE FUNCTION protect_tournament_terms();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_tournament_materialized_terms() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE root_id text;
BEGIN
 IF TG_TABLE_NAME='competition_instances' THEN root_id:=OLD.id; ELSE root_id:=COALESCE(OLD.instance_id,NEW.instance_id); END IF;
 IF EXISTS(SELECT 1 FROM competition_tournaments WHERE instance_id=root_id) THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Tournament accounting terms are immutable'; END IF;
  IF TG_OP='INSERT' THEN RAISE EXCEPTION 'Tournament prize schedule is already frozen'; END IF;
  IF TG_TABLE_NAME='competition_instances' THEN
   IF (NEW.template_id,NEW.game_id,NEW.format,NEW.participant_capacity,NEW.currency,NEW.entry_fee_minor,NEW.rules_version,NEW.skill_assessment_version,NEW.jurisdiction)
    IS DISTINCT FROM (OLD.template_id,OLD.game_id,OLD.format,OLD.participant_capacity,OLD.currency,OLD.entry_fee_minor,OLD.rules_version,OLD.skill_assessment_version,OLD.jurisdiction)
    THEN RAISE EXCEPTION 'Tournament instance terms are immutable'; END IF;
  ELSIF (to_jsonb(NEW)-'awarded_user_id') IS DISTINCT FROM (to_jsonb(OLD)-'awarded_user_id') OR (OLD.awarded_user_id IS NOT NULL AND NEW.awarded_user_id IS DISTINCT FROM OLD.awarded_user_id) THEN RAISE EXCEPTION 'Tournament prize is immutable'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER tournament_instance_terms BEFORE UPDATE OR DELETE ON competition_instances FOR EACH ROW EXECUTE FUNCTION protect_tournament_materialized_terms();
CREATE OR REPLACE TRIGGER tournament_prize_terms BEFORE INSERT OR UPDATE OR DELETE ON competition_instance_prizes FOR EACH ROW EXECUTE FUNCTION protect_tournament_materialized_terms();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_qualification_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-'applied_at') IS DISTINCT FROM (to_jsonb(OLD)-'applied_at') OR (OLD.applied_at IS NOT NULL AND NEW.applied_at IS DISTINCT FROM OLD.applied_at)
 THEN RAISE EXCEPTION 'Qualification completion evidence is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER qualification_event_immutable BEFORE UPDATE OR DELETE ON competition_qualification_events FOR EACH ROW EXECUTE FUNCTION protect_qualification_evidence();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_qualification_ticket() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Qualification tickets are auditable and cannot be deleted'; END IF;
 IF (NEW.id,NEW.user_id,NEW.game_id,NEW.product,NEW.cycle_id,NEW.qualified_at,NEW.source_instances)
  IS DISTINCT FROM (OLD.id,OLD.user_id,OLD.game_id,OLD.product,OLD.cycle_id,OLD.qualified_at,OLD.source_instances)
  OR (OLD.consumed_at IS NOT NULL AND NEW.consumed_at IS DISTINCT FROM OLD.consumed_at)
  OR (OLD.consumed_instance_id IS NOT NULL AND NEW.consumed_instance_id IS DISTINCT FROM OLD.consumed_instance_id)
  OR (OLD.replaced_by IS NOT NULL AND NEW.replaced_by IS DISTINCT FROM OLD.replaced_by)
  OR (NEW.state<>OLD.state AND NOT (
    (OLD.state='AVAILABLE' AND NEW.state IN ('CONSUMED','EXPIRED','REVOKED')) OR
    (OLD.state='CONSUMED' AND NEW.state IN ('EXPIRED','REPLACED','REVOKED')) OR
    (OLD.state='EXPIRED' AND NEW.state='REPLACED')))
 THEN RAISE EXCEPTION 'Qualification ticket evidence and terminal transitions are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER qualification_ticket_immutable BEFORE UPDATE OR DELETE ON competition_qualification_tickets FOR EACH ROW EXECUTE FUNCTION protect_qualification_ticket();
