-- Sessions issued before this security release intentionally require sign-in again.
CREATE TABLE IF NOT EXISTS auth_session_revocations (
 session_id text PRIMARY KEY,
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_session_revocations_expiry ON auth_session_revocations(expires_at);
--> statement-breakpoint
-- Fugluck owns HTTP authentication. No customer requires direct public-schema access.
-- Keep the backend table owner privileges; do not touch Supabase's auth/storage schemas.
DO $$
DECLARE browser_role text; target_schema text := current_schema();
BEGIN
 EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM PUBLIC',target_schema);
 EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM PUBLIC',target_schema);
 EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA %I FROM PUBLIC',target_schema);
 FOR browser_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
  EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM %I',target_schema,browser_role);
  EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM %I',target_schema,browser_role);
  EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA %I FROM %I',target_schema,browser_role);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM %I',target_schema,browser_role);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM %I',target_schema,browser_role);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE EXECUTE ON FUNCTIONS FROM %I',target_schema,browser_role);
 END LOOP;
 EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC',target_schema);
END $$;
