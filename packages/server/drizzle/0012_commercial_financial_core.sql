-- Phase 7B candidate. Apply only to a disposable test database until a
-- separately reviewed staging migration rollout. No real-money switch is enabled.
CREATE TABLE commercial_accounts (
  id text PRIMARY KEY,
  currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  kind varchar(32) NOT NULL CHECK (kind IN (
    'USER_AVAILABLE','USER_ENTRY_RESERVED','USER_WITHDRAWAL_RESERVED',
    'ENTRY_CAPTURED','PLATFORM_MARGIN','PRIZE_OBLIGATION',
    'PROMOTIONAL_SUBSIDY','PROVIDER_CLEARING','PROCESSING_FEES',
    'FINANCIAL_ADJUSTMENTS','CHARGEBACKS')),
  user_id text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, currency),
  CHECK ((kind LIKE 'USER_%') = (user_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE commercial_transactions (
  id text PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  request_hash char(64) NOT NULL,
  event_type varchar(48) NOT NULL,
  currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  actor_id text NOT NULL,
  source varchar(48) NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  reference_id text,
  provider_reference text,
  audit_reference text,
  creation_xid bigint NOT NULL DEFAULT txid_current(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, currency)
);
--> statement-breakpoint
CREATE TABLE commercial_postings (
  id bigserial PRIMARY KEY,
  transaction_id text NOT NULL,
  account_id text NOT NULL,
  currency varchar(3) NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor <> 0 AND amount_minor BETWEEN -9000000000000000 AND 9000000000000000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (transaction_id, currency) REFERENCES commercial_transactions(id, currency),
  FOREIGN KEY (account_id, currency) REFERENCES commercial_accounts(id, currency)
);
--> statement-breakpoint
CREATE INDEX commercial_postings_account_idx ON commercial_postings(account_id, id);
--> statement-breakpoint
CREATE INDEX commercial_postings_transaction_idx ON commercial_postings(transaction_id);
--> statement-breakpoint
CREATE TABLE commercial_operations (
  id text PRIMARY KEY,
  kind varchar(24) NOT NULL CHECK (kind IN ('DEPOSIT','WITHDRAWAL','ENTRY','COMPETITION')),
  status varchar(32) NOT NULL,
  user_id text REFERENCES users(id),
  competition_instance_id text REFERENCES competition_instances(id),
  currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint NOT NULL CHECK (amount_minor BETWEEN 0 AND 9000000000000000),
  provider_reference text,
  terminal_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, competition_instance_id, user_id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX commercial_operations_provider_ref_idx ON commercial_operations(provider_reference) WHERE provider_reference IS NOT NULL;
--> statement-breakpoint
CREATE TABLE commercial_operation_events (
  id bigserial PRIMARY KEY,
  operation_id text NOT NULL REFERENCES commercial_operations(id),
  from_status varchar(32),
  to_status varchar(32) NOT NULL,
  actor_id text NOT NULL,
  source varchar(48) NOT NULL,
  reason text NOT NULL,
  provider_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE commercial_provider_events (
  id text PRIMARY KEY,
  provider_reference text NOT NULL,
  operation_id text REFERENCES commercial_operations(id),
  event_type varchar(32) NOT NULL,
  currency varchar(3) NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor BETWEEN 0 AND 9000000000000000),
  payload_hash char(64) NOT NULL,
  status varchar(24) NOT NULL CHECK (status IN ('APPLIED','DUPLICATE','OUT_OF_ORDER','MISMATCH','UNMATCHED')),
  received_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE commercial_risk_cases (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  status varchar(24) NOT NULL CHECK (status IN ('OPEN','IN_REVIEW','CLEARED','RESTRICTED')),
  signals jsonb NOT NULL,
  enforcement_action varchar(24) CHECK (enforcement_action IN ('NONE','BLOCK_DEPOSITS','BLOCK_COMPETITIONS','BLOCK_WITHDRAWALS','BLOCK_ALL')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE commercial_risk_events (
  id bigserial PRIMARY KEY,
  case_id text NOT NULL REFERENCES commercial_risk_cases(id),
  actor_id text NOT NULL,
  action varchar(64) NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason))>0),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION commercial_reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Commercial financial history is append-only';
END $$;
--> statement-breakpoint
CREATE TRIGGER commercial_transactions_immutable BEFORE UPDATE OR DELETE ON commercial_transactions FOR EACH ROW EXECUTE FUNCTION commercial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER commercial_transactions_no_truncate BEFORE TRUNCATE ON commercial_transactions FOR EACH STATEMENT EXECUTE FUNCTION commercial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER commercial_postings_immutable BEFORE UPDATE OR DELETE ON commercial_postings FOR EACH ROW EXECUTE FUNCTION commercial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER commercial_postings_no_truncate BEFORE TRUNCATE ON commercial_postings FOR EACH STATEMENT EXECUTE FUNCTION commercial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER commercial_accounts_immutable BEFORE UPDATE OR DELETE ON commercial_accounts FOR EACH ROW EXECUTE FUNCTION commercial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER commercial_accounts_no_truncate BEFORE TRUNCATE ON commercial_accounts FOR EACH STATEMENT EXECUTE FUNCTION commercial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER commercial_operation_events_immutable BEFORE UPDATE OR DELETE ON commercial_operation_events FOR EACH ROW EXECUTE FUNCTION commercial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER commercial_operation_events_no_truncate BEFORE TRUNCATE ON commercial_operation_events FOR EACH STATEMENT EXECUTE FUNCTION commercial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER commercial_provider_events_immutable BEFORE UPDATE OR DELETE ON commercial_provider_events FOR EACH ROW EXECUTE FUNCTION commercial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER commercial_provider_events_no_truncate BEFORE TRUNCATE ON commercial_provider_events FOR EACH STATEMENT EXECUTE FUNCTION commercial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER commercial_risk_events_immutable BEFORE UPDATE OR DELETE ON commercial_risk_events FOR EACH ROW EXECUTE FUNCTION commercial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER commercial_risk_events_no_truncate BEFORE TRUNCATE ON commercial_risk_events FOR EACH STATEMENT EXECUTE FUNCTION commercial_reject_mutation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION commercial_posting_same_transaction() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE creation_transaction bigint;
BEGIN
  SELECT creation_xid INTO creation_transaction FROM commercial_transactions WHERE id=NEW.transaction_id;
  IF creation_transaction IS DISTINCT FROM txid_current() THEN
    RAISE EXCEPTION 'Commercial posting must be inserted with its transaction';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER commercial_posting_creation_guard BEFORE INSERT ON commercial_postings FOR EACH ROW EXECUTE FUNCTION commercial_posting_same_transaction();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION commercial_check_transaction_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE total numeric;
DECLARE posting_count integer;
BEGIN
  SELECT count(*), COALESCE(sum(amount_minor),0) INTO posting_count,total
  FROM commercial_postings WHERE transaction_id=NEW.id;
  IF posting_count < 2 OR total <> 0 THEN
    RAISE EXCEPTION 'Commercial transaction % is not balanced', NEW.id;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER commercial_transaction_balanced AFTER INSERT ON commercial_transactions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION commercial_check_transaction_balance();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION commercial_check_user_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account_kind text;
DECLARE total numeric;
BEGIN
  SELECT kind INTO account_kind FROM commercial_accounts WHERE id=NEW.account_id FOR UPDATE;
  IF account_kind LIKE 'USER_%' THEN
    SELECT COALESCE(sum(amount_minor),0) INTO total FROM commercial_postings WHERE account_id=NEW.account_id;
    IF total < 0 THEN RAISE EXCEPTION 'Commercial user balance cannot be negative: %', NEW.account_id; END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER commercial_user_nonnegative AFTER INSERT ON commercial_postings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION commercial_check_user_balance();
