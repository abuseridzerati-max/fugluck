// Guard with centralized disposable database check before anything else
import "./require-disposable-test-database.ts";

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: "packages/server/.env" });

import { Pool } from "pg";

let failures = 0;
let passes = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    passes++;
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function applyMigrations(pool: Pool): Promise<void> {
  const drizzleDir = path.resolve(process.cwd(), "packages/server/drizzle");
  const migrationFiles = [
    "0000_early_marrow.sql",
    "0001_wallet_friends.sql",
    "0002_ledger_idempotency_unique.sql",
    "0003_matches_history.sql",
    "0004_atomic_wager_lifecycle.sql",
    "0005_reconcile_schema_parity.sql",
    "0006_password_reset_tokens.sql",
    "0007_policy_acceptances.sql",
    "0008_competition_economy.sql",
    "0009_sandbox_accounting.sql",
    "0010_competition_authority.sql",
  ];

  console.log("\nPhase 1: Applying migration chain (0000 -> 0010) to disposable database...\n");

  const client = await pool.connect();
  try {
    for (const filename of migrationFiles) {
      const filePath = path.join(drizzleDir, filename);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Migration file not found: ${filePath}`);
      }

      const sqlContent = fs.readFileSync(filePath, "utf-8");
      const statements = sqlContent
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      console.log(`Applying ${filename} (${statements.length} statements)...`);
      for (const stmt of statements) {
        try {
          await client.query(stmt);
        } catch (err: any) {
          // If a table or index already exists from an earlier test run, handle gracefully
          if (err.code === "42P07" || err.code === "42710") {
            // duplicate_table or duplicate_object
            continue;
          }
          throw new Error(`Failed executing statement in ${filename}:\n${stmt}\nError: ${err.message}`);
        }
      }
      console.log(`  ✓ ${filename} applied successfully.`);
    }
  } finally {
    client.release();
  }
}

async function verifySchema(pool: Pool): Promise<void> {
  console.log("\nPhase 2: Introspecting PostgreSQL Catalogs & Asserting Schema Parity...\n");

  // 1. Verify all 19 expected tables exist
  const expectedTables = [
    "users",
    "email_verification_tokens",
    "password_reset_tokens",
    "policy_acceptances",
    "admin_lockout_attempts",
    "admin_audit_logs",
    "ledger_entries",
    "friendships",
    "matches_history",
    "match_settlements",
    "trivia_questions",
    "competition_templates",
    "competition_template_prizes",
    "competition_instances",
    "competition_instance_prizes",
    "competition_participants",
    "sandbox_entry_reservations",
    "sandbox_ledger_entries",
    "sandbox_settlements",
    'competition_authority_runs', 'competition_authority_sessions', 'competition_authority_results', 'competition_authority_decisions',
  ];

  const tableRes = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  );
  const existingTables = new Set(tableRes.rows.map((r: any) => r.table_name));

  for (const tableName of expectedTables) {
    check(`Table '${tableName}' exists in public schema`, existingTables.has(tableName));
  }

  const authorityColumns: Record<string, string[]> = {
    competition_authority_runs: ['id','instance_id','match_id','game_id','version','seed','cap_ticks','owner_id','fence','lease_until','status','start_at','deadline','terminal_at','created_at'],
    competition_authority_sessions: ['id','run_id','user_id','controller_id','epoch','nonce_hash','status','terminal_at'],
    competition_authority_results: ['id','session_id','score','ticks','reason','created_at'],
    competition_authority_decisions: ['run_id','kind','winner_user_id','reason','result_ids','created_at','applied_at'],
  };
  const authoritySchema = await pool.query(`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'competition_authority_%'`);
  for (const [table, columns] of Object.entries(authorityColumns)) for (const column of columns) {
    check(`${table}.${column} exists`, authoritySchema.rows.some(r=>r.table_name===table&&r.column_name===column));
  }
  const authorityTriggers = await pool.query(`SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('authority_result_immutable','authority_decision_immutable')`);
  check('Authority result immutability trigger exists', authorityTriggers.rows.some(r=>r.tgname==='authority_result_immutable'));
  check('Authority terminal decision immutability trigger exists', authorityTriggers.rows.some(r=>r.tgname==='authority_decision_immutable'));

  // 2. Verify all columns for newly migrated tables
  const emailTokenCols = await pool.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'email_verification_tokens'`,
  );
  const emailCols = new Set(emailTokenCols.rows.map((r: any) => r.column_name));
  check("email_verification_tokens has id column", emailCols.has("id"));
  check("email_verification_tokens has user_id column", emailCols.has("user_id"));
  check("email_verification_tokens has token_hash column", emailCols.has("token_hash"));
  check("email_verification_tokens has expires_at column", emailCols.has("expires_at"));
  check("email_verification_tokens has created_at column", emailCols.has("created_at"));

  const resetTokenCols = await pool.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'password_reset_tokens'`,
  );
  const resetCols = new Set(resetTokenCols.rows.map((r: any) => r.column_name));
  check("password_reset_tokens has id column", resetCols.has("id"));
  check("password_reset_tokens has user_id column", resetCols.has("user_id"));
  check("password_reset_tokens has token_hash column", resetCols.has("token_hash"));
  check("password_reset_tokens has expires_at column", resetCols.has("expires_at"));
  check("password_reset_tokens has created_at column", resetCols.has("created_at"));

  const policyAcceptanceCols = await pool.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'policy_acceptances'`,
  );
  const policyCols = new Set(policyAcceptanceCols.rows.map((r: any) => r.column_name));
  check("policy_acceptances has id column", policyCols.has("id"));
  check("policy_acceptances has user_id column", policyCols.has("user_id"));
  check("policy_acceptances has policy_type column", policyCols.has("policy_type"));
  check("policy_acceptances has policy_version column", policyCols.has("policy_version"));
  check("policy_acceptances has source column", policyCols.has("source"));
  check("policy_acceptances has ip_address column", policyCols.has("ip_address"));
  check("policy_acceptances has user_agent column", policyCols.has("user_agent"));
  check("policy_acceptances has accepted_at column", policyCols.has("accepted_at"));

  const lockoutCols = await pool.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'admin_lockout_attempts'`,
  );
  const lockoutColSet = new Set(lockoutCols.rows.map((r: any) => r.column_name));
  check("admin_lockout_attempts has id column", lockoutColSet.has("id"));
  check("admin_lockout_attempts has ip_address column", lockoutColSet.has("ip_address"));
  check("admin_lockout_attempts has attempt_count column", lockoutColSet.has("attempt_count"));
  check("admin_lockout_attempts has locked_until column", lockoutColSet.has("locked_until"));
  check("admin_lockout_attempts has last_attempt_at column", lockoutColSet.has("last_attempt_at"));

  const auditLogCols = await pool.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'admin_audit_logs'`,
  );
  const auditColSet = new Set(auditLogCols.rows.map((r: any) => r.column_name));
  check("admin_audit_logs has id column", auditColSet.has("id"));
  check("admin_audit_logs has admin_user_id column", auditColSet.has("admin_user_id"));
  check("admin_audit_logs has action column", auditColSet.has("action"));
  check("admin_audit_logs has target_type column", auditColSet.has("target_type"));
  check("admin_audit_logs has amount column", auditColSet.has("amount"));
  check("admin_audit_logs has currency column", auditColSet.has("currency"));
  check("admin_audit_logs has reason column", auditColSet.has("reason"));
  check("admin_audit_logs has idempotency_key column", auditColSet.has("idempotency_key"));
  check("admin_audit_logs has details column (jsonb)", auditColSet.has("details"));

  const triviaCols = await pool.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'trivia_questions'`,
  );
  const triviaColSet = new Set(triviaCols.rows.map((r: any) => r.column_name));
  check("trivia_questions has id column (bigserial)", triviaColSet.has("id"));
  check("trivia_questions has category column", triviaColSet.has("category"));
  check("trivia_questions has question column", triviaColSet.has("question"));
  check("trivia_questions has correct_answer column", triviaColSet.has("correct_answer"));
  check("trivia_questions has incorrect_answers column (jsonb)", triviaColSet.has("incorrect_answers"));

  // 2b. Verify columns for Phase 1 Competition Economy tables
  const tmplCols = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'competition_templates'`,
  );
  const tmplColSet = new Set(tmplCols.rows.map((r: any) => r.column_name));
  check("competition_templates has id", tmplColSet.has("id"));
  check("competition_templates has game_id", tmplColSet.has("game_id"));
  check("competition_templates has title", tmplColSet.has("title"));
  check("competition_templates has format", tmplColSet.has("format"));
  check("competition_templates has participant_capacity", tmplColSet.has("participant_capacity"));
  check("competition_templates has currency", tmplColSet.has("currency"));
  check("competition_templates has entry_fee_minor", tmplColSet.has("entry_fee_minor"));
  check("competition_templates has rules_version", tmplColSet.has("rules_version"));
  check("competition_templates has skill_assessment_version", tmplColSet.has("skill_assessment_version"));
  check("competition_templates has enabled", tmplColSet.has("enabled"));
  check("competition_templates has jurisdiction", tmplColSet.has("jurisdiction"));
  check("competition_templates has created_at", tmplColSet.has("created_at"));
  check("competition_templates has updated_at", tmplColSet.has("updated_at"));

  const tmplPrizeCols = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'competition_template_prizes'`,
  );
  const tmplPrizeColSet = new Set(tmplPrizeCols.rows.map((r: any) => r.column_name));
  check("competition_template_prizes has id", tmplPrizeColSet.has("id"));
  check("competition_template_prizes has template_id", tmplPrizeColSet.has("template_id"));
  check("competition_template_prizes has placement", tmplPrizeColSet.has("placement"));
  check("competition_template_prizes has amount_minor", tmplPrizeColSet.has("amount_minor"));
  check("competition_template_prizes has currency", tmplPrizeColSet.has("currency"));

  const instCols = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'competition_instances'`,
  );
  const instColSet = new Set(instCols.rows.map((r: any) => r.column_name));
  check("competition_instances has id", instColSet.has("id"));
  check("competition_instances has template_id", instColSet.has("template_id"));
  check("competition_instances has game_id", instColSet.has("game_id"));
  check("competition_instances has format", instColSet.has("format"));
  check("competition_instances has participant_capacity", instColSet.has("participant_capacity"));
  check("competition_instances has currency", instColSet.has("currency"));
  check("competition_instances has entry_fee_minor", instColSet.has("entry_fee_minor"));
  check("competition_instances has rules_version", instColSet.has("rules_version"));
  check("competition_instances has skill_assessment_version", instColSet.has("skill_assessment_version"));
  check("competition_instances has jurisdiction", instColSet.has("jurisdiction"));
  check("competition_instances has status", instColSet.has("status"));
  check("competition_instances has current_participants", instColSet.has("current_participants"));
  check("competition_instances has match_id", instColSet.has("match_id"));
  check("competition_instances has winner_user_id", instColSet.has("winner_user_id"));
  check("competition_instances has locked_at", instColSet.has("locked_at"));
  check("competition_instances has started_at", instColSet.has("started_at"));
  check("competition_instances has settled_at", instColSet.has("settled_at"));
  check("competition_instances has created_at", instColSet.has("created_at"));

  const instPrizeCols = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'competition_instance_prizes'`,
  );
  const instPrizeColSet = new Set(instPrizeCols.rows.map((r: any) => r.column_name));
  check("competition_instance_prizes has id", instPrizeColSet.has("id"));
  check("competition_instance_prizes has instance_id", instPrizeColSet.has("instance_id"));
  check("competition_instance_prizes has placement", instPrizeColSet.has("placement"));
  check("competition_instance_prizes has amount_minor", instPrizeColSet.has("amount_minor"));
  check("competition_instance_prizes has currency", instPrizeColSet.has("currency"));
  check("competition_instance_prizes has awarded_user_id", instPrizeColSet.has("awarded_user_id"));

  const partCols = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'competition_participants'`,
  );
  const partColSet = new Set(partCols.rows.map((r: any) => r.column_name));
  check("competition_participants has id", partColSet.has("id"));
  check("competition_participants has instance_id", partColSet.has("instance_id"));
  check("competition_participants has user_id", partColSet.has("user_id"));
  check("competition_participants has seat_index", partColSet.has("seat_index"));
  check("competition_participants has entry_fee_minor", partColSet.has("entry_fee_minor"));
  check("competition_participants has score", partColSet.has("score"));
  check("competition_participants has rank", partColSet.has("rank"));
  check("competition_participants has prize_won_minor", partColSet.has("prize_won_minor"));
  check("competition_participants has status", partColSet.has("status"));
  check("competition_participants has registered_at", partColSet.has("registered_at"));

  const matchCols = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'matches_history'`,
  );
  const matchColSet = new Set(matchCols.rows.map((r: any) => r.column_name));
  check("matches_history has competition_instance_id column", matchColSet.has("competition_instance_id"));

  const sandboxResCols = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'sandbox_entry_reservations'`,
  );
  const sandboxResColSet = new Set(sandboxResCols.rows.map((r: any) => r.column_name));
  check("sandbox_entry_reservations has id", sandboxResColSet.has("id"));
  check("sandbox_entry_reservations has competition_instance_id", sandboxResColSet.has("competition_instance_id"));
  check("sandbox_entry_reservations has user_id", sandboxResColSet.has("user_id"));
  check("sandbox_entry_reservations has currency", sandboxResColSet.has("currency"));
  check("sandbox_entry_reservations has amount_minor", sandboxResColSet.has("amount_minor"));
  check("sandbox_entry_reservations has status", sandboxResColSet.has("status"));
  check("sandbox_entry_reservations has idempotency_key", sandboxResColSet.has("idempotency_key"));
  check("sandbox_entry_reservations has accounting_reference_id", sandboxResColSet.has("accounting_reference_id"));
  check("sandbox_entry_reservations has created_at", sandboxResColSet.has("created_at"));
  check("sandbox_entry_reservations has updated_at", sandboxResColSet.has("updated_at"));

  const sandboxLedgerCols = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'sandbox_ledger_entries'`,
  );
  const sandboxLedgerColSet = new Set(sandboxLedgerCols.rows.map((r: any) => r.column_name));
  check("sandbox_ledger_entries has id", sandboxLedgerColSet.has("id"));
  check("sandbox_ledger_entries has accounting_reference_id", sandboxLedgerColSet.has("accounting_reference_id"));
  check("sandbox_ledger_entries has idempotency_key", sandboxLedgerColSet.has("idempotency_key"));
  check("sandbox_ledger_entries has competition_instance_id", sandboxLedgerColSet.has("competition_instance_id"));
  check("sandbox_ledger_entries has user_id", sandboxLedgerColSet.has("user_id"));
  check("sandbox_ledger_entries has account_id", sandboxLedgerColSet.has("account_id"));
  check("sandbox_ledger_entries has event_type", sandboxLedgerColSet.has("event_type"));
  check("sandbox_ledger_entries has currency", sandboxLedgerColSet.has("currency"));
  check("sandbox_ledger_entries has amount_minor", sandboxLedgerColSet.has("amount_minor"));
  check("sandbox_ledger_entries has balance_type", sandboxLedgerColSet.has("balance_type"));
  check("sandbox_ledger_entries has description", sandboxLedgerColSet.has("description"));
  check("sandbox_ledger_entries has created_at", sandboxLedgerColSet.has("created_at"));

  const sandboxSettlementCols = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'sandbox_settlements'`,
  );
  const sandboxSettlementColSet = new Set(sandboxSettlementCols.rows.map((r: any) => r.column_name));
  check("sandbox_settlements has competition_instance_id", sandboxSettlementColSet.has("competition_instance_id"));
  check("sandbox_settlements has status", sandboxSettlementColSet.has("status"));
  check("sandbox_settlements has total_entries_captured_minor", sandboxSettlementColSet.has("total_entries_captured_minor"));
  check("sandbox_settlements has total_prizes_awarded_minor", sandboxSettlementColSet.has("total_prizes_awarded_minor"));
  check("sandbox_settlements has platform_margin_minor", sandboxSettlementColSet.has("platform_margin_minor"));
  check("sandbox_settlements has promotional_subsidy_minor", sandboxSettlementColSet.has("promotional_subsidy_minor"));
  check("sandbox_settlements has currency", sandboxSettlementColSet.has("currency"));
  check("sandbox_settlements has accounting_reference_id", sandboxSettlementColSet.has("accounting_reference_id"));
  check("sandbox_settlements has idempotency_key", sandboxSettlementColSet.has("idempotency_key"));
  check("sandbox_settlements has settled_at", sandboxSettlementColSet.has("settled_at"));

  // 3. Verify Foreign Keys
  const fkRes = await pool.query(`
    SELECT conname, conrelid::regclass AS table_name, confrelid::regclass AS foreign_table_name
    FROM pg_constraint
    WHERE contype = 'f'
  `);
  const fks = new Set(fkRes.rows.map((r: any) => `${r.table_name}->${r.foreign_table_name}`));
  check("email_verification_tokens FK to users", fks.has("email_verification_tokens->users"));
  check("password_reset_tokens FK to users", fks.has("password_reset_tokens->users"));
  check("policy_acceptances FK to users", fks.has("policy_acceptances->users"));
  check("admin_audit_logs FK to users", fks.has("admin_audit_logs->users"));
  check("ledger_entries FK to users", fks.has("ledger_entries->users"));
  check("friendships FK to users", fks.has("friendships->users"));
  check("match_settlements FK to matches_history", fks.has("match_settlements->matches_history"));
  check("competition_template_prizes FK to competition_templates", fks.has("competition_template_prizes->competition_templates"));
  check("competition_instances FK to competition_templates", fks.has("competition_instances->competition_templates"));
  check("competition_instances FK to users (winner)", fks.has("competition_instances->users"));
  check("competition_instance_prizes FK to competition_instances", fks.has("competition_instance_prizes->competition_instances"));
  check("competition_instance_prizes FK to users (awarded)", fks.has("competition_instance_prizes->users"));
  check("competition_participants FK to competition_instances", fks.has("competition_participants->competition_instances"));
  check("competition_participants FK to users", fks.has("competition_participants->users"));
  check("matches_history FK to competition_instances", fks.has("matches_history->competition_instances"));
  check("sandbox_entry_reservations FK to competition_instances", fks.has("sandbox_entry_reservations->competition_instances"));
  check("sandbox_entry_reservations FK to users", fks.has("sandbox_entry_reservations->users"));
  check("sandbox_ledger_entries FK to competition_instances", fks.has("sandbox_ledger_entries->competition_instances"));
  check("sandbox_ledger_entries FK to users", fks.has("sandbox_ledger_entries->users"));
  check("sandbox_settlements FK to competition_instances", fks.has("sandbox_settlements->competition_instances"));

  // 4. Verify Constraint Validation Status (All CHECK and FK constraints MUST be convalidated = true)
  const validationRes = await pool.query(`
    SELECT conname, conrelid::regclass AS table_name, contype, convalidated
    FROM pg_constraint
    WHERE conrelid::regclass::text IN (
      'matches_history',
      'match_settlements',
      'ledger_entries',
      'competition_templates',
      'competition_template_prizes',
      'competition_instances',
      'competition_instance_prizes',
      'competition_participants',
      'sandbox_entry_reservations',
      'sandbox_ledger_entries',
      'sandbox_settlements'
    )
      AND contype IN ('c', 'f')
  `);
  for (const row of validationRes.rows) {
    check(
      `Constraint '${row.conname}' on '${row.table_name}' is fully validated (convalidated=true)`,
      row.convalidated === true,
      `Expected convalidated=true, found ${row.convalidated}`,
    );
  }

  // 4b. Verify specific domain check constraints exist
  const checkConstraintsRes = await pool.query(`
    SELECT conname, conrelid::regclass AS table_name
    FROM pg_constraint
    WHERE contype = 'c'
  `);
  const checkNames = new Set(checkConstraintsRes.rows.map((r: any) => `${r.table_name}.${r.conname}`));
  check("Check 'comp_templates_fee_check' exists", checkNames.has("competition_templates.comp_templates_fee_check"));
  check("Check 'comp_templates_cap_check' exists", checkNames.has("competition_templates.comp_templates_cap_check"));
  check("Check 'tmpl_prizes_amount_check' exists", checkNames.has("competition_template_prizes.tmpl_prizes_amount_check"));
  check("Check 'tmpl_prizes_placement_check' exists", checkNames.has("competition_template_prizes.tmpl_prizes_placement_check"));
  check("Check 'comp_instances_cap_check' exists", checkNames.has("competition_instances.comp_instances_cap_check"));
  check("Check 'comp_instances_fee_check' exists", checkNames.has("competition_instances.comp_instances_fee_check"));
  check("Check 'inst_prizes_amount_check' exists", checkNames.has("competition_instance_prizes.inst_prizes_amount_check"));
  check("Check 'inst_prizes_placement_check' exists", checkNames.has("competition_instance_prizes.inst_prizes_placement_check"));
  check("Check 'comp_part_seat_check' exists", checkNames.has("competition_participants.comp_part_seat_check"));
  check("Check 'comp_part_fee_check' exists", checkNames.has("competition_participants.comp_part_fee_check"));
  check("Check 'comp_part_prize_check' exists", checkNames.has("competition_participants.comp_part_prize_check"));
  check("Check 'matches_history_currency_check' exists", checkNames.has("matches_history.matches_history_currency_check"));
  check("Check 'match_settlements_currency_check' exists", checkNames.has("match_settlements.match_settlements_currency_check"));
  check("Check 'sandbox_res_amount_check' exists", checkNames.has("sandbox_entry_reservations.sandbox_res_amount_check"));
  check("Check 'sandbox_res_status_check' exists", checkNames.has("sandbox_entry_reservations.sandbox_res_status_check"));
  check("Check 'sandbox_ledger_balance_type_check' exists", checkNames.has("sandbox_ledger_entries.sandbox_ledger_balance_type_check"));
  check("Check 'sandbox_settlements_status_check' exists", checkNames.has("sandbox_settlements.sandbox_settlements_status_check"));
  check("Check 'sandbox_settlements_entries_check' exists", checkNames.has("sandbox_settlements.sandbox_settlements_entries_check"));
  check("Check 'sandbox_settlements_prizes_check' exists", checkNames.has("sandbox_settlements.sandbox_settlements_prizes_check"));

  // 5. Verify Indexes
  const idxRes = await pool.query(`
    SELECT indexname, tablename
    FROM pg_indexes
    WHERE schemaname = 'public'
  `);
  const indexes = new Set(idxRes.rows.map((r: any) => `${r.tablename}.${r.indexname}`));
  check("Index 'idx_trivia_cat_id' exists on trivia_questions", indexes.has("trivia_questions.idx_trivia_cat_id"));
  check("Index 'idx_policy_acceptances_user_type' exists on policy_acceptances", indexes.has("policy_acceptances.idx_policy_acceptances_user_type"));
  check("Index 'idx_policy_acceptances_type_version' exists on policy_acceptances", indexes.has("policy_acceptances.idx_policy_acceptances_type_version"));
  check("Unique index 'ledger_user_reason_unique' exists on ledger_entries", indexes.has("ledger_entries.ledger_user_reason_unique"));
  check("Index 'ledger_user_currency_idx' exists on ledger_entries", indexes.has("ledger_entries.ledger_user_currency_idx"));
  check("Unique index 'friendships_pair_unique' exists on friendships", indexes.has("friendships.friendships_pair_unique"));
  check("Index 'idx_matches_p1' exists on matches_history", indexes.has("matches_history.idx_matches_p1"));
  check("Index 'idx_matches_status' exists on matches_history", indexes.has("matches_history.idx_matches_status"));
  check("Index 'idx_comp_templates_game' exists on competition_templates", indexes.has("competition_templates.idx_comp_templates_game"));
  check("Index 'idx_comp_templates_enabled' exists on competition_templates", indexes.has("competition_templates.idx_comp_templates_enabled"));
  check("Unique index 'idx_tmpl_prizes_template_place' exists on competition_template_prizes", indexes.has("competition_template_prizes.idx_tmpl_prizes_template_place"));
  check("Index 'idx_comp_instances_template' exists on competition_instances", indexes.has("competition_instances.idx_comp_instances_template"));
  check("Index 'idx_comp_instances_status' exists on competition_instances", indexes.has("competition_instances.idx_comp_instances_status"));
  check("Unique index 'idx_inst_prizes_instance_place' exists on competition_instance_prizes", indexes.has("competition_instance_prizes.idx_inst_prizes_instance_place"));
  check("Unique index 'idx_comp_part_instance_user' exists on competition_participants", indexes.has("competition_participants.idx_comp_part_instance_user"));
  check("Unique index 'idx_comp_part_instance_seat' exists on competition_participants", indexes.has("competition_participants.idx_comp_part_instance_seat"));
  check("Index 'idx_matches_competition_instance' exists on matches_history", indexes.has("matches_history.idx_matches_competition_instance"));
  check("Unique index 'idx_sandbox_res_instance_user' exists on sandbox_entry_reservations", indexes.has("sandbox_entry_reservations.idx_sandbox_res_instance_user"));
  check("Unique index 'idx_sandbox_res_idempotency' exists on sandbox_entry_reservations", indexes.has("sandbox_entry_reservations.idx_sandbox_res_idempotency"));
  check("Index 'idx_sandbox_res_user_status' exists on sandbox_entry_reservations", indexes.has("sandbox_entry_reservations.idx_sandbox_res_user_status"));
  check("Index 'idx_sandbox_ledger_account' exists on sandbox_ledger_entries", indexes.has("sandbox_ledger_entries.idx_sandbox_ledger_account"));
  check("Index 'idx_sandbox_ledger_ref' exists on sandbox_ledger_entries", indexes.has("sandbox_ledger_entries.idx_sandbox_ledger_ref"));
  check("Index 'idx_sandbox_ledger_inst' exists on sandbox_ledger_entries", indexes.has("sandbox_ledger_entries.idx_sandbox_ledger_inst"));
  check("Index 'idx_sandbox_ledger_user' exists on sandbox_ledger_entries", indexes.has("sandbox_ledger_entries.idx_sandbox_ledger_user"));
  check("Unique index 'idx_sandbox_ledger_idempotency' exists on sandbox_ledger_entries", indexes.has("sandbox_ledger_entries.idx_sandbox_ledger_idempotency"));
  check("Unique index 'idx_sandbox_settlements_idempotency' exists on sandbox_settlements", indexes.has("sandbox_settlements.idx_sandbox_settlements_idempotency"));

  // 6. Verify Trigger & Function
  const triggerRes = await pool.query(`
    SELECT tgname, relname
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE tgname IN ('ledger_non_negative_guard', 'sandbox_balance_non_negative_guard')
  `);
  const triggers = new Set(triggerRes.rows.map((r: any) => `${r.relname}.${r.tgname}`));
  check("Trigger 'ledger_non_negative_guard' is attached to ledger_entries", triggers.has("ledger_entries.ledger_non_negative_guard"));
  check("Trigger 'sandbox_balance_non_negative_guard' is attached to sandbox_ledger_entries", triggers.has("sandbox_ledger_entries.sandbox_balance_non_negative_guard"));

  const procRes = await pool.query(`
    SELECT proname FROM pg_proc WHERE proname IN ('enforce_non_negative_ledger_balance', 'enforce_non_negative_sandbox_balance')
  `);
  const procs = new Set(procRes.rows.map((r: any) => r.proname));
  check("Trigger function 'enforce_non_negative_ledger_balance' exists", procs.has("enforce_non_negative_ledger_balance"));
  check("Trigger function 'enforce_non_negative_sandbox_balance' exists", procs.has("enforce_non_negative_sandbox_balance"));

  // 7. Verify Platform Rake Account
  const rakeRes = await pool.query(`
    SELECT id, username FROM users WHERE id = 'platform_rake_account'
  `);
  check("Platform rake account exists in users table", rakeRes.rows.length > 0);

  // 7b. Hard Architectural Invariant: NO constraint equates entries collected to prizes + fee
  const compChecksRes = await pool.query(`
    SELECT c.conname, c.conrelid::regclass AS table_name, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    WHERE c.contype = 'c'
      AND c.conrelid::regclass::text IN (
        'competition_templates',
        'competition_instances',
        'competition_template_prizes',
        'competition_instance_prizes',
        'competition_participants'
      )
  `);
  let hasPotOrRakeConstraint = false;
  for (const row of compChecksRes.rows) {
    const def = row.def.toLowerCase();
    if (def.includes("fee") && (def.includes("prize") || def.includes("amount")) && (def.includes("*") || def.includes("+"))) {
      hasPotOrRakeConstraint = true;
      console.error(`Forbidden pot/rake constraint detected: ${row.conname} on ${row.table_name}: ${row.def}`);
    }
  }
  check("Invariant: NO constraint requires entries collected = prizes + platform fee", !hasPotOrRakeConstraint);

  // 8. Runtime DML Smoke Test against all newly migrated tables
  const testUserId = "test_migrated_user_" + Date.now();
  const testOpponentId = "test_migrated_opp_" + Date.now();
  await pool.query(
    `INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [testUserId, "test_migrated_" + Date.now(), "hash"],
  );
  await pool.query(
    `INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [testOpponentId, "test_opp_" + Date.now(), "hash"],
  );

  const tokenInsert = await pool.query(
    `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, NOW() + interval '1 day') RETURNING id`,
    ["evt_test_" + Date.now(), testUserId, "token_hash_" + Date.now()],
  );
  check("DML smoke: INSERT into email_verification_tokens succeeds", tokenInsert.rows.length === 1);

  const resetInsert = await pool.query(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, NOW() + interval '1 hour') RETURNING id`,
    ["prt_test_" + Date.now(), testUserId, "reset_hash_" + Date.now()],
  );
  check("DML smoke: INSERT into password_reset_tokens succeeds", resetInsert.rows.length === 1);

  const policyInsert = await pool.query(
    `INSERT INTO policy_acceptances (id, user_id, policy_type, policy_version, source, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    ["pa_test_" + Date.now(), testUserId, "TERMS", "2026-08-18", "registration", "127.0.0.1", "Mozilla/5.0"],
  );
  check("DML smoke: INSERT into policy_acceptances succeeds", policyInsert.rows.length === 1);

  const lockoutInsert = await pool.query(
    `INSERT INTO admin_lockout_attempts (id, ip_address, attempt_count)
     VALUES ($1, $2, $3) RETURNING id`,
    ["lock_test_" + Date.now(), "127.0.0.1" + Math.random(), 1],
  );
  check("DML smoke: INSERT into admin_lockout_attempts succeeds", lockoutInsert.rows.length === 1);

  const auditInsert = await pool.query(
    `INSERT INTO admin_audit_logs (id, admin_user_id, action, target_type, target_id, amount, currency, reason, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      "audit_test_" + Date.now(),
      testUserId,
      "wallet_grant",
      "user",
      testUserId,
      100,
      "COINS",
      "test grant",
      "idem_test_" + Date.now(),
    ],
  );
  check("DML smoke: INSERT into admin_audit_logs succeeds", auditInsert.rows.length === 1);

  const triviaInsert = await pool.query(
    `INSERT INTO trivia_questions (category, difficulty, question, correct_answer, incorrect_answers)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    ["General", "easy", "What is 2+2?", "4", JSON.stringify(["1", "2", "3"])],
  );
  check("DML smoke: INSERT into trivia_questions succeeds", triviaInsert.rows.length === 1);

  // 9. Phase 1 Competition Economy DML Verification
  const ts = Date.now();
  const tmplStandardId = `tmpl_std_${ts}`;
  const tmplPromoId = `tmpl_promo_${ts}`;
  const tmplFreerollId = `tmpl_freeroll_${ts}`;
  const tmplMultiId = `tmpl_multi_${ts}`;

  // Case A: 2 players, 500 minor entry (₾5.00), 900 minor prize (₾9.00)
  await pool.query(
    `INSERT INTO competition_templates (id, game_id, title, format, participant_capacity, currency, entry_fee_minor, rules_version, skill_assessment_version, jurisdiction)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [tmplStandardId, "space-blaster", "Standard 1v1", "HEAD_TO_HEAD", 2, "GEL", 500, "v1.0", "v1.0", "GE"],
  );
  await pool.query(
    `INSERT INTO competition_template_prizes (id, template_id, placement, amount_minor, currency)
     VALUES ($1, $2, $3, $4, $5)`,
    [`tp_std_${ts}`, tmplStandardId, 1, 900, "GEL"],
  );
  check("DML smoke: Case A standard paid template and prize inserted (500 fee, 900 prize)", true);

  // Case B: 2 players, 500 minor entry (₾5.00), 2000 minor prize (₾20.00 promotional overlay)
  await pool.query(
    `INSERT INTO competition_templates (id, game_id, title, format, participant_capacity, currency, entry_fee_minor, rules_version, skill_assessment_version, jurisdiction)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [tmplPromoId, "cyber-hopper", "Promotional 1v1", "HEAD_TO_HEAD", 2, "GEL", 500, "v1.0", "v1.0", "GE"],
  );
  await pool.query(
    `INSERT INTO competition_template_prizes (id, template_id, placement, amount_minor, currency)
     VALUES ($1, $2, $3, $4, $5)`,
    [`tp_promo_${ts}`, tmplPromoId, 1, 2000, "GEL"],
  );
  check("DML smoke: Case B promotional prize overlay inserted (prize > entries collected)", true);

  // Case C: 64 players, 0 minor entry (Freeroll), 100,000 minor prize (₾1,000 sponsored prize)
  await pool.query(
    `INSERT INTO competition_templates (id, game_id, title, format, participant_capacity, currency, entry_fee_minor, rules_version, skill_assessment_version, jurisdiction)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [tmplFreerollId, "pixel-ninja-dash", "Freeroll 64", "BRACKET", 64, "GEL", 0, "v1.0", "v1.0", "GE"],
  );
  await pool.query(
    `INSERT INTO competition_template_prizes (id, template_id, placement, amount_minor, currency)
     VALUES ($1, $2, $3, $4, $5)`,
    [`tp_freeroll_${ts}`, tmplFreerollId, 1, 100000, "GEL"],
  );
  check("DML smoke: Case C Freeroll template inserted (0 entry fee, 100000 sponsored prize)", true);

  // Case D: Multiple placement prizes (1st: 600, 2nd: 300)
  await pool.query(
    `INSERT INTO competition_templates (id, game_id, title, format, participant_capacity, currency, entry_fee_minor, rules_version, skill_assessment_version, jurisdiction)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [tmplMultiId, "neon-runner", "Multi Prize 1v1", "HEAD_TO_HEAD", 2, "GEL", 500, "v1.0", "v1.0", "GE"],
  );
  await pool.query(
    `INSERT INTO competition_template_prizes (id, template_id, placement, amount_minor, currency) VALUES ($1, $2, $3, $4, $5)`,
    [`tp_m1_${ts}`, tmplMultiId, 1, 600, "GEL"],
  );
  await pool.query(
    `INSERT INTO competition_template_prizes (id, template_id, placement, amount_minor, currency) VALUES ($1, $2, $3, $4, $5)`,
    [`tp_m2_${ts}`, tmplMultiId, 2, 300, "GEL"],
  );
  check("DML smoke: Case D multi-placement prizes inserted (1st: 600, 2nd: 300)", true);

  // Duplicate placement rejection on template prizes
  let duplicateTmplPlaceRejected = false;
  try {
    await pool.query(
      `INSERT INTO competition_template_prizes (id, template_id, placement, amount_minor, currency)
       VALUES ($1, $2, $3, $4, $5)`,
      [`tp_dup_${ts}`, tmplMultiId, 1, 999, "GEL"],
    );
  } catch {
    duplicateTmplPlaceRejected = true;
  }
  check("DML constraint: Duplicate placement on template prizes is rejected", duplicateTmplPlaceRejected);

  // Competition Instance Snapshots material terms
  const instId = `inst_smoke_${ts}`;
  await pool.query(
    `INSERT INTO competition_instances (
       id, template_id, game_id, format, participant_capacity, currency,
       entry_fee_minor, rules_version, skill_assessment_version, jurisdiction,
       status, current_participants
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      instId, tmplStandardId, "space-blaster", "HEAD_TO_HEAD", 2, "GEL",
      500, "v1.0", "v1.0", "GE",
      "PENDING_ENTRANTS", 0,
    ],
  );
  check("DML smoke: Competition instance created with snapshotted terms", true);

  // Instance Prize snapshots template prize
  const instPrizeId = `ip_smoke_${ts}`;
  await pool.query(
    `INSERT INTO competition_instance_prizes (id, instance_id, placement, amount_minor, currency)
     VALUES ($1, $2, $3, $4, $5)`,
    [instPrizeId, instId, 1, 900, "GEL"],
  );
  check("DML smoke: Competition instance prize snapshotted", true);

  // Duplicate placement rejection on instance prizes
  let duplicateInstPlaceRejected = false;
  try {
    await pool.query(
      `INSERT INTO competition_instance_prizes (id, instance_id, placement, amount_minor, currency)
       VALUES ($1, $2, $3, $4, $5)`,
      [`ip_dup_${ts}`, instId, 1, 500, "GEL"],
    );
  } catch {
    duplicateInstPlaceRejected = true;
  }
  check("DML constraint: Duplicate placement on instance prizes is rejected", duplicateInstPlaceRejected);

  // Register participants into instance
  const part1Id = `part1_${ts}`;
  const part2Id = `part2_${ts}`;
  await pool.query(
    `INSERT INTO competition_participants (id, instance_id, user_id, seat_index, entry_fee_minor, status)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [part1Id, instId, testUserId, 0, 500, "REGISTERED"],
  );
  await pool.query(
    `INSERT INTO competition_participants (id, instance_id, user_id, seat_index, entry_fee_minor, status)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [part2Id, instId, testOpponentId, 1, 500, "REGISTERED"],
  );
  check("DML smoke: Competition participants registered successfully", true);

  // Duplicate user in instance rejection
  let duplicateUserRejected = false;
  try {
    await pool.query(
      `INSERT INTO competition_participants (id, instance_id, user_id, seat_index, entry_fee_minor, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [`part_dup_user_${ts}`, instId, testUserId, 2, 500, "REGISTERED"],
    );
  } catch {
    duplicateUserRejected = true;
  }
  check("DML constraint: Duplicate user registration in same instance is rejected", duplicateUserRejected);

  // Duplicate seat rejection
  let duplicateSeatRejected = false;
  try {
    await pool.query(
      `INSERT INTO competition_participants (id, instance_id, user_id, seat_index, entry_fee_minor, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [`part_dup_seat_${ts}`, instId, "some_other_user", 0, 500, "REGISTERED"],
    );
  } catch {
    duplicateSeatRejected = true;
  }
  check("DML constraint: Duplicate seat registration in same instance is rejected", duplicateSeatRejected);

  // Negative amount check rejections
  let negativeFeeRejected = false;
  try {
    await pool.query(
      `INSERT INTO competition_templates (id, game_id, title, format, participant_capacity, currency, entry_fee_minor, rules_version, skill_assessment_version, jurisdiction)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [`tmpl_neg_${ts}`, "space-blaster", "Negative Fee", "HEAD_TO_HEAD", 2, "GEL", -100, "v1.0", "v1.0", "GE"],
    );
  } catch {
    negativeFeeRejected = true;
  }
  check("DML constraint: Negative entry_fee_minor rejected", negativeFeeRejected);

  let negativePrizeRejected = false;
  try {
    await pool.query(
      `INSERT INTO competition_template_prizes (id, template_id, placement, amount_minor, currency)
       VALUES ($1, $2, $3, $4, $5)`,
      [`tp_neg_${ts}`, tmplStandardId, 99, -50, "GEL"],
    );
  } catch {
    negativePrizeRejected = true;
  }
  check("DML constraint: Negative prize amount_minor rejected", negativePrizeRejected);

  // 10. Historical Currency Compatibility Verification (COINS, DIAMONDS, GEL)
  const matchDiamondsId = `m_diam_${ts}`;
  const matchCoinsId = `m_coins_${ts}`;
  const matchGelId = `m_gel_${ts}`;

  await pool.query(
    `INSERT INTO matches_history (id, game_id, player1_id, player2_id, currency, stake, seed, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [matchDiamondsId, "space-blaster", testUserId, testOpponentId, "DIAMONDS", 100, 12345, "COMPLETED"],
  );
  await pool.query(
    `INSERT INTO matches_history (id, game_id, player1_id, player2_id, currency, stake, seed, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [matchCoinsId, "space-blaster", testUserId, testOpponentId, "COINS", 50, 12346, "COMPLETED"],
  );
  await pool.query(
    `INSERT INTO matches_history (id, game_id, player1_id, player2_id, currency, stake, seed, status, competition_instance_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [matchGelId, "space-blaster", testUserId, testOpponentId, "GEL", 500, 12347, "COMPLETED", instId],
  );
  check("Historical compatibility: matches_history accepts DIAMONDS, COINS, and GEL", true);

  await pool.query(
    `INSERT INTO match_settlements (match_id, status, winner_id, loser_id, currency, stake, winner_payout, rake_fee)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [matchDiamondsId, "PAYOUT", testUserId, testOpponentId, "DIAMONDS", 100, 190, 10],
  );
  await pool.query(
    `INSERT INTO match_settlements (match_id, status, winner_id, loser_id, currency, stake, winner_payout, rake_fee)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [matchCoinsId, "PAYOUT", testUserId, testOpponentId, "COINS", 50, 95, 5],
  );
  await pool.query(
    `INSERT INTO match_settlements (match_id, status, winner_id, loser_id, currency, stake, winner_payout, rake_fee)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [matchGelId, "PAYOUT", testUserId, testOpponentId, "GEL", 500, 950, 50],
  );
  check("Historical compatibility: match_settlements accepts DIAMONDS, COINS, and GEL", true);

  // Verify invalid currency rejected
  let invalidCurrRejected = false;
  try {
    await pool.query(
      `INSERT INTO matches_history (id, game_id, player1_id, player2_id, currency, stake, seed, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [`m_invalid_${ts}`, "space-blaster", testUserId, testOpponentId, "INVALID_TOKEN", 100, 12348, "ACTIVE"],
    );
  } catch {
    invalidCurrRejected = true;
  }
  check("Currency check: invalid currency rejected on matches_history", invalidCurrRejected);

  // 11. Sandbox Accounting DML Smoke Test and Overdraft Guard Verification
  const sbResId = `sb_res_${ts}`;
  const sbRefId = `sb_ref_${ts}`;
  const sbIdemKey = `sb_idem_${ts}`;

  // 11a. Test funding grant (balanced double-entry: platform treasury debit + user available credit)
  await pool.query(
    `INSERT INTO sandbox_ledger_entries (id, accounting_reference_id, idempotency_key, user_id, account_id, event_type, currency, amount_minor, balance_type, description)
     VALUES 
      ($1, $2, $3, NULL, $4, $5, $6, $7, $8, $9),
      ($10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
    [
      `sb_le_tr_grant_${ts}`, sbRefId, `${sbIdemKey}_tr_grant`, "platform:treasury:GEL", "FUNDING_GRANT", "GEL", -1000, "AVAILABLE", "Test funding grant treasury debit",
      `sb_le_grant_${ts}`, sbRefId, `${sbIdemKey}_grant`, testUserId, `user:${testUserId}:available`, "FUNDING_GRANT", "GEL", 1000, "AVAILABLE", "Test funding grant user credit",
    ],
  );
  check("DML smoke: sandbox_ledger_entries funding grant recorded", true);

  // 11b. Test entry reservation
  await pool.query(
    `INSERT INTO sandbox_entry_reservations (id, competition_instance_id, user_id, currency, amount_minor, status, idempotency_key, accounting_reference_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [sbResId, instId, testUserId, "GEL", 500, "RESERVED", `${sbIdemKey}_res`, sbRefId],
  );
  check("DML smoke: sandbox_entry_reservations row inserted", true);

  // 11c. Move 500 from AVAILABLE to RESERVED
  await pool.query(
    `INSERT INTO sandbox_ledger_entries (id, accounting_reference_id, idempotency_key, competition_instance_id, user_id, account_id, event_type, currency, amount_minor, balance_type, description)
     VALUES 
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11),
      ($12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
    [
      `sb_le_res_deb_${ts}`, sbRefId, `${sbIdemKey}_res_deb`, instId, testUserId, `user:${testUserId}:available`, "ENTRY_RESERVATION", "GEL", -500, "AVAILABLE", "Reserve entry fee",
      `sb_le_res_crd_${ts}`, sbRefId, `${sbIdemKey}_res_crd`, instId, testUserId, `user:${testUserId}:reserved`, "ENTRY_RESERVATION", "GEL", 500, "RESERVED", "Reserve entry fee",
    ],
  );
  check("DML smoke: sandbox reservation ledger entries recorded", true);

  // 11d. Overdraft guard test: Attempting to debit more than available must trigger error
  let overdraftRejected = false;
  try {
    await pool.query(
      `INSERT INTO sandbox_ledger_entries (id, accounting_reference_id, idempotency_key, user_id, account_id, event_type, currency, amount_minor, balance_type, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [`sb_le_od_${ts}`, `ref_od_${ts}`, `idem_od_${ts}`, testUserId, `user:${testUserId}:available`, "ENTRY_RESERVATION", "GEL", -10000, "AVAILABLE", "Illegal overdraft attempt"],
    );
  } catch (err: any) {
    if (err.message && (err.message.includes("Sandbox balance overdraft") || err.message.toLowerCase().includes("overdraft"))) {
      overdraftRejected = true;
    }
  }
  check("Trigger guard: sandbox balance overdraft attempt rejected by trigger", overdraftRejected);

  // 11e. Settlement record test
  await pool.query(
    `INSERT INTO sandbox_settlements (competition_instance_id, status, total_entries_captured_minor, total_prizes_awarded_minor, platform_margin_minor, promotional_subsidy_minor, currency, accounting_reference_id, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [instId, "SETTLED", 1000, 900, 100, 0, "GEL", `sb_settle_ref_${ts}`, `${sbIdemKey}_settle`],
  );
  check("DML smoke: sandbox_settlements row inserted", true);

  // Clean up smoke rows in proper foreign key order
  await pool.query(`DELETE FROM sandbox_settlements WHERE competition_instance_id = $1`, [instId]);
  await pool.query(`DELETE FROM sandbox_ledger_entries WHERE accounting_reference_id = $1 OR user_id IN ($2, $3)`, [sbRefId, testUserId, testOpponentId]);
  await pool.query(`DELETE FROM sandbox_entry_reservations WHERE competition_instance_id = $1`, [instId]);
  await pool.query(`DELETE FROM match_settlements WHERE match_id IN ($1, $2, $3)`, [matchDiamondsId, matchCoinsId, matchGelId]);
  await pool.query(`DELETE FROM matches_history WHERE id IN ($1, $2, $3)`, [matchDiamondsId, matchCoinsId, matchGelId]);
  await pool.query(`DELETE FROM competition_participants WHERE instance_id = $1`, [instId]);
  await pool.query(`DELETE FROM competition_instance_prizes WHERE instance_id = $1`, [instId]);
  await pool.query(`DELETE FROM competition_instances WHERE id = $1`, [instId]);
  await pool.query(`DELETE FROM competition_template_prizes WHERE template_id IN ($1, $2, $3, $4)`, [tmplStandardId, tmplPromoId, tmplFreerollId, tmplMultiId]);
  await pool.query(`DELETE FROM competition_templates WHERE id IN ($1, $2, $3, $4)`, [tmplStandardId, tmplPromoId, tmplFreerollId, tmplMultiId]);
  await pool.query(`DELETE FROM email_verification_tokens WHERE user_id IN ($1, $2)`, [testUserId, testOpponentId]);
  await pool.query(`DELETE FROM password_reset_tokens WHERE user_id IN ($1, $2)`, [testUserId, testOpponentId]);
  await pool.query(`DELETE FROM policy_acceptances WHERE user_id IN ($1, $2)`, [testUserId, testOpponentId]);
  await pool.query(`DELETE FROM admin_audit_logs WHERE admin_user_id IN ($1, $2)`, [testUserId, testOpponentId]);
  await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [testUserId, testOpponentId]);
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL!;
  // Scoped SSL config for cloud PostgreSQL connections (Supabase/Neon)
  const isLocalhost = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
  const isSslRequired =
    !isLocalhost &&
    (connectionString.includes("sslmode=require") ||
      connectionString.includes("supabase.com") ||
      connectionString.includes("neon.tech") ||
      process.env.NODE_ENV === "production");

  const cleanConnectionString = isSslRequired
    ? connectionString.replace(/[?&]sslmode=[^&]+/g, "").replace(/\?$/, "")
    : connectionString;

  const pool = new Pool({
    connectionString: cleanConnectionString,
    ssl: isSslRequired ? { rejectUnauthorized: false } : undefined,
  });
  try {
    await applyMigrations(pool);
    await verifySchema(pool);

    console.log(`\n==================================================`);
    console.log(`Migration Parity Check: ${passes} PASS, ${failures} FAIL`);
    console.log(`==================================================\n`);

    if (failures > 0) {
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal error during migration parity check:", err);
  process.exit(1);
});
