import { boolean, bigserial, check, foreignKey, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: varchar("username", { length: 32 }).notNull().unique(),
  email: varchar("email", { length: 255 }).unique(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  gamesPlayed: integer("games_played").notNull().default(0),
  gamesWon: integer("games_won").notNull().default(0),
  role: varchar("role", { length: 20 }).notNull().default("user"),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  statusReason: text("status_reason"),
  isEmailVerified: boolean("is_email_verified").notNull().default(false),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminLockoutAttempts = pgTable("admin_lockout_attempts", {
  id: text("id").primaryKey(),
  ipAddress: varchar("ip_address", { length: 64 }).notNull().unique(),
  attemptCount: integer("attempt_count").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: text("id").primaryKey(),
  adminUserId: text("admin_user_id")
    .notNull()
    .references(() => users.id),
  action: varchar("action", { length: 64 }).notNull(),
  targetType: varchar("target_type", { length: 32 }).notNull().default("system"),
  targetId: text("target_id"),
  amount: integer("amount"),
  currency: varchar("currency", { length: 16 }),
  reason: text("reason").notNull().default("No reason provided"),
  idempotencyKey: text("idempotency_key").unique(),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Append-only wallet ledger. Balances are SUM(amount) per (userId, currency).
// Never update/delete rows — grant/spend by inserting a new entry.
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    // "COINS" (free Fmoney) or "DIAMONDS" (premium). Stored as text so a new
    // currency is a new value, not a schema migration — see PROGRESS.md.
    currency: varchar("currency", { length: 16 }).notNull(),
    // Signed integer minor units. Positive = credit, negative = debit.
    amount: integer("amount").notNull(),
    reason: varchar("reason", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userReasonUnique: uniqueIndex("ledger_user_reason_unique").on(t.userId, t.reason),
    userCurrencyIdx: index("ledger_user_currency_idx").on(t.userId, t.currency),
  }),
);

export const friendships = pgTable(
  "friendships",
  {
    id: text("id").primaryKey(),
    requesterId: text("requester_id")
      .notNull()
      .references(() => users.id),
    addresseeId: text("addressee_id")
      .notNull()
      .references(() => users.id),
    // pending | accepted | rejected
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pairUnique: uniqueIndex("friendships_pair_unique").on(t.requesterId, t.addresseeId),
  }),
);

export const matchesHistory = pgTable(
  "matches_history",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id").notNull(),
    player1Id: text("player1_id").notNull(),
    player2Id: text("player2_id").notNull(),
    winnerId: text("winner_id"),
    currency: varchar("currency", { length: 16 }).notNull().default("COINS"),
    stake: integer("stake").notNull().default(0),
    seed: bigserial("seed", { mode: "number" }).notNull(),
    inputLogP1: jsonb("input_log_p1"),
    inputLogP2: jsonb("input_log_p2"),
    scoreP1: integer("score_p1").notNull().default(0),
    scoreP2: integer("score_p2").notNull().default(0),
    status: varchar("status", { length: 16 }).notNull().default("ACTIVE"),
    statusReason: text("status_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    competitionInstanceId: text("competition_instance_id"),
  },
  (t) => ({
    p1Idx: index("idx_matches_p1").on(t.player1Id),
    p2Idx: index("idx_matches_p2").on(t.player2Id),
    gameIdx: index("idx_matches_game").on(t.gameId),
    statusIdx: index("idx_matches_status").on(t.status),
    createdAtIdx: index("idx_matches_created").on(t.createdAt),
    compInstanceIdx: index("idx_matches_competition_instance").on(t.competitionInstanceId),
    currencyCheck: check("matches_history_currency_check", sql`${t.currency} in ('COINS', 'DIAMONDS', 'GEL')`),
    stakeCheck: check("matches_history_stake_check", sql`${t.stake} >= 0`),
  }),
);

// Database-enforced atomic match settlement record. Primary key is match_id.
// Enforces that a match can produce EXACTLY ONE settlement outcome (PAYOUT | REFUND | VOIDED).
export const matchSettlements = pgTable(
  "match_settlements",
  {
    matchId: text("match_id").primaryKey(),
    status: varchar("status", { length: 16 }).notNull(),
    winnerId: text("winner_id"),
    loserId: text("loser_id"),
    currency: varchar("currency", { length: 16 }).notNull(),
    stake: integer("stake").notNull().default(0),
    winnerPayout: integer("winner_payout").notNull().default(0),
    rakeFee: integer("rake_fee").notNull().default(0),
    settledAt: timestamp("settled_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    matchFk: foreignKey({ columns: [t.matchId], foreignColumns: [matchesHistory.id] }),
    statusCheck: check("match_settlements_status_check", sql`${t.status} in ('PAYOUT', 'REFUND', 'DRAW', 'VOIDED')`),
    currencyCheck: check("match_settlements_currency_check", sql`${t.currency} in ('COINS', 'DIAMONDS', 'GEL')`),
    amountCheck: check(
      "match_settlements_amount_check",
      sql`${t.stake} > 0 and ${t.winnerPayout} >= 0 and ${t.rakeFee} >= 0`,
    ),
    payoutShapeCheck: check(
      "match_settlements_payout_shape_check",
      sql`(${t.status} = 'PAYOUT' and ${t.winnerId} is not null and ${t.loserId} is not null) or (${t.status} <> 'PAYOUT' and ${t.winnerId} is null and ${t.loserId} is null and ${t.winnerPayout} = 0 and ${t.rakeFee} = 0)`,
    ),
  }),
);

export const triviaQuestions = pgTable(
  "trivia_questions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    category: varchar("category", { length: 80 }).notNull(),
    difficulty: varchar("difficulty", { length: 20 }),
    question: text("question").notNull(),
    correctAnswer: text("correct_answer").notNull(),
    incorrectAnswers: jsonb("incorrect_answers").notNull(),
  },
  (t) => ({
    catIdIdx: index("idx_trivia_cat_id").on(t.category, t.id),
  }),
);

export const policyAcceptances = pgTable(
  "policy_acceptances",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    policyType: varchar("policy_type", { length: 32 }).notNull(),
    policyVersion: varchar("policy_version", { length: 32 }).notNull(),
    source: varchar("source", { length: 32 }).notNull().default("registration"),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userPolicyIdx: index("idx_policy_acceptances_user_type").on(t.userId, t.policyType),
    typeVersionIdx: index("idx_policy_acceptances_type_version").on(t.policyType, t.policyVersion),
  }),
);

// ===========================================================================
// Competition Domain Tables (Phase 1)
// Implements FUGLUCK — FINAL COMPETITION DOMAIN CONTRACT
// ===========================================================================

export const competitionTemplates = pgTable(
  "competition_templates",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    gameId: text("game_id").notNull(),
    title: varchar("title", { length: 128 }).notNull(),
    format: varchar("format", { length: 32 }).notNull().default("HEAD_TO_HEAD"),
    participantCapacity: integer("participant_capacity").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("GEL"),
    entryFeeMinor: integer("entry_fee_minor").notNull(),
    rulesVersion: varchar("rules_version", { length: 32 }).notNull(),
    skillAssessmentVersion: varchar("skill_assessment_version", { length: 32 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    jurisdiction: varchar("jurisdiction", { length: 8 }).notNull().default("GE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    gameIdx: index("idx_comp_templates_game").on(t.gameId),
    enabledIdx: index("idx_comp_templates_enabled").on(t.enabled),
    entryFeeCheck: check("comp_templates_fee_check", sql`${t.entryFeeMinor} >= 0`),
    capacityCheck: check("comp_templates_cap_check", sql`${t.participantCapacity} >= 2`),
  }),
);

export const competitionTemplatePrizes = pgTable(
  "competition_template_prizes",
  {
    id: text("id").primaryKey(),
    templateId: varchar("template_id", { length: 64 })
      .notNull()
      .references(() => competitionTemplates.id),
    placement: integer("placement").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("GEL"),
  },
  (t) => ({
    templatePlaceUnique: uniqueIndex("idx_tmpl_prizes_template_place").on(t.templateId, t.placement),
    amountCheck: check("tmpl_prizes_amount_check", sql`${t.amountMinor} >= 0`),
    placementCheck: check("tmpl_prizes_placement_check", sql`${t.placement} >= 1`),
  }),
);

// CompetitionInstance snapshots all material competition and financial terms
// from its template upon creation so that subsequent template edits never alter
// existing instances.
export const competitionInstances = pgTable(
  "competition_instances",
  {
    id: text("id").primaryKey(),
    templateId: varchar("template_id", { length: 64 })
      .notNull()
      .references(() => competitionTemplates.id),
    gameId: text("game_id").notNull(),
    format: varchar("format", { length: 32 }).notNull(),
    participantCapacity: integer("participant_capacity").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    entryFeeMinor: integer("entry_fee_minor").notNull(),
    rulesVersion: varchar("rules_version", { length: 32 }).notNull(),
    skillAssessmentVersion: varchar("skill_assessment_version", { length: 32 }).notNull(),
    jurisdiction: varchar("jurisdiction", { length: 8 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("PENDING_ENTRANTS"),
    currentParticipants: integer("current_participants").notNull().default(0),
    matchId: text("match_id"),
    winnerUserId: text("winner_user_id").references(() => users.id),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    templateIdx: index("idx_comp_instances_template").on(t.templateId),
    statusIdx: index("idx_comp_instances_status").on(t.status),
    capacityCheck: check("comp_instances_cap_check", sql`${t.currentParticipants} <= ${t.participantCapacity}`),
    entryFeeCheck: check("comp_instances_fee_check", sql`${t.entryFeeMinor} >= 0`),
  }),
);

export const competitionInstancePrizes = pgTable(
  "competition_instance_prizes",
  {
    id: text("id").primaryKey(),
    instanceId: text("instance_id")
      .notNull()
      .references(() => competitionInstances.id),
    placement: integer("placement").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    awardedUserId: text("awarded_user_id").references(() => users.id),
  },
  (t) => ({
    instancePlaceUnique: uniqueIndex("idx_inst_prizes_instance_place").on(t.instanceId, t.placement),
    amountCheck: check("inst_prizes_amount_check", sql`${t.amountMinor} >= 0`),
    placementCheck: check("inst_prizes_placement_check", sql`${t.placement} >= 1`),
  }),
);

export const competitionParticipants = pgTable(
  "competition_participants",
  {
    id: text("id").primaryKey(),
    instanceId: text("instance_id")
      .notNull()
      .references(() => competitionInstances.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    seatIndex: integer("seat_index").notNull(),
    entryFeeMinor: integer("entry_fee_minor").notNull(),
    score: integer("score"),
    rank: integer("rank"),
    prizeWonMinor: integer("prize_won_minor").notNull().default(0),
    status: varchar("status", { length: 16 }).notNull().default("REGISTERED"),
    registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    instanceUserUnique: uniqueIndex("idx_comp_part_instance_user").on(t.instanceId, t.userId),
    instanceSeatUnique: uniqueIndex("idx_comp_part_instance_seat").on(t.instanceId, t.seatIndex),
    seatCheck: check("comp_part_seat_check", sql`${t.seatIndex} >= 0`),
    entryFeeCheck: check("comp_part_fee_check", sql`${t.entryFeeMinor} >= 0`),
    prizeWonCheck: check("comp_part_prize_check", sql`${t.prizeWonMinor} >= 0`),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type Friendship = typeof friendships.$inferSelect;
export type MatchHistoryRecord = typeof matchesHistory.$inferSelect;
export type MatchSettlement = typeof matchSettlements.$inferSelect;
export type TriviaQuestion = typeof triviaQuestions.$inferSelect;
export type NewTriviaQuestion = typeof triviaQuestions.$inferInsert;
export type PolicyAcceptance = typeof policyAcceptances.$inferSelect;
export type NewPolicyAcceptance = typeof policyAcceptances.$inferInsert;

export type CompetitionTemplateRecord = typeof competitionTemplates.$inferSelect;
export type NewCompetitionTemplateRecord = typeof competitionTemplates.$inferInsert;
export type CompetitionTemplatePrizeRecord = typeof competitionTemplatePrizes.$inferSelect;
export type NewCompetitionTemplatePrizeRecord = typeof competitionTemplatePrizes.$inferInsert;
export type CompetitionInstanceRecord = typeof competitionInstances.$inferSelect;
export type NewCompetitionInstanceRecord = typeof competitionInstances.$inferInsert;
export type CompetitionInstancePrizeRecord = typeof competitionInstancePrizes.$inferSelect;
export type NewCompetitionInstancePrizeRecord = typeof competitionInstancePrizes.$inferInsert;
export type CompetitionParticipantRecord = typeof competitionParticipants.$inferSelect;
export type NewCompetitionParticipantRecord = typeof competitionParticipants.$inferInsert;

// ===========================================================================
// Sandbox Accounting Domain Tables (Phase 2)
// Implements FUGLUCK — FINAL COMPETITION DOMAIN CONTRACT
// Provides isolated, auditable, balanced accounting for sandbox competition
// entry reservations, captures, releases, prize awards, and refunds.
// ===========================================================================

export const sandboxEntryReservations = pgTable(
  "sandbox_entry_reservations",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    competitionInstanceId: text("competition_instance_id")
      .notNull()
      .references(() => competitionInstances.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    currency: varchar("currency", { length: 3 }).notNull().default("GEL"),
    amountMinor: integer("amount_minor").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("RESERVED"),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    accountingReferenceId: varchar("accounting_reference_id", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    instanceUserUnique: uniqueIndex("idx_sandbox_res_instance_user").on(t.competitionInstanceId, t.userId),
    idempotencyUnique: uniqueIndex("idx_sandbox_res_idempotency").on(t.idempotencyKey),
    userStatusIdx: index("idx_sandbox_res_user_status").on(t.userId, t.status),
    amountCheck: check("sandbox_res_amount_check", sql`${t.amountMinor} >= 0`),
    statusCheck: check(
      "sandbox_res_status_check",
      sql`${t.status} in ('RESERVED', 'CAPTURED', 'RELEASED', 'REFUNDED')`,
    ),
  }),
);

export const sandboxLedgerEntries = pgTable(
  "sandbox_ledger_entries",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    accountingReferenceId: varchar("accounting_reference_id", { length: 64 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }),
    competitionInstanceId: text("competition_instance_id").references(() => competitionInstances.id),
    userId: text("user_id").references(() => users.id),
    accountId: varchar("account_id", { length: 64 }).notNull(),
    eventType: varchar("event_type", { length: 32 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("GEL"),
    amountMinor: integer("amount_minor").notNull(),
    balanceType: varchar("balance_type", { length: 16 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    accountBalanceIdx: index("idx_sandbox_ledger_account").on(t.accountId, t.balanceType),
    refIdx: index("idx_sandbox_ledger_ref").on(t.accountingReferenceId),
    instanceIdx: index("idx_sandbox_ledger_inst").on(t.competitionInstanceId),
    userIdx: index("idx_sandbox_ledger_user").on(t.userId),
    idempotencyUnique: uniqueIndex("idx_sandbox_ledger_idempotency").on(t.idempotencyKey),
    balanceTypeCheck: check(
      "sandbox_ledger_balance_type_check",
      sql`${t.balanceType} in ('AVAILABLE', 'RESERVED', 'CAPTURED', 'SETTLED')`,
    ),
  }),
);

export const sandboxSettlements = pgTable(
  "sandbox_settlements",
  {
    competitionInstanceId: text("competition_instance_id")
      .primaryKey()
      .references(() => competitionInstances.id),
    status: varchar("status", { length: 16 }).notNull(),
    totalEntriesCapturedMinor: integer("total_entries_captured_minor").notNull(),
    totalPrizesAwardedMinor: integer("total_prizes_awarded_minor").notNull(),
    platformMarginMinor: integer("platform_margin_minor").notNull().default(0),
    promotionalSubsidyMinor: integer("promotional_subsidy_minor").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("GEL"),
    accountingReferenceId: varchar("accounting_reference_id", { length: 64 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    settledAt: timestamp("settled_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idempotencyUnique: uniqueIndex("idx_sandbox_settlements_idempotency").on(t.idempotencyKey),
    statusCheck: check("sandbox_settlements_status_check", sql`${t.status} in ('SETTLED', 'REFUNDED', 'VOIDED')`),
    entriesCheck: check("sandbox_settlements_entries_check", sql`${t.totalEntriesCapturedMinor} >= 0`),
    prizesCheck: check("sandbox_settlements_prizes_check", sql`${t.totalPrizesAwardedMinor} >= 0`),
    marginCheck: check("sandbox_settlements_margin_check", sql`${t.platformMarginMinor} >= 0`),
    subsidyCheck: check("sandbox_settlements_subsidy_check", sql`${t.promotionalSubsidyMinor} >= 0`),
  }),
);

export type SandboxEntryReservationRecord = typeof sandboxEntryReservations.$inferSelect;
export type NewSandboxEntryReservationRecord = typeof sandboxEntryReservations.$inferInsert;
export type SandboxLedgerEntryRecord = typeof sandboxLedgerEntries.$inferSelect;
export type NewSandboxLedgerEntryRecord = typeof sandboxLedgerEntries.$inferInsert;
export type SandboxSettlementRecord = typeof sandboxSettlements.$inferSelect;
export type NewSandboxSettlementRecord = typeof sandboxSettlements.$inferInsert;

export const competitionAuthorityRuns = pgTable('competition_authority_runs', {
  id: text('id').primaryKey(), instanceId: text('instance_id').notNull().unique().references(() => competitionInstances.id),
  matchId: text('match_id').notNull().unique().references(() => matchesHistory.id),
  gameId: text('game_id').notNull(), version: text('version').notNull(), seed: integer('seed').notNull(),
  capTicks: integer('cap_ticks').notNull().default(10800),
  ownerId: text('owner_id').notNull(), fence: integer('fence').notNull().default(1),
  leaseUntil: timestamp('lease_until', { withTimezone: true }).notNull(), status: text('status').notNull().default('CREATED'),
  startAt: timestamp('start_at', { withTimezone: true }), deadline: timestamp('deadline', { withTimezone: true }),
  terminalAt: timestamp('terminal_at', { withTimezone: true }), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  statusCheck: check('competition_authority_runs_status_check', sql`${t.status} in ('CREATED','READY','ACTIVE','COMPLETED','VOIDED')`),
  capCheck: check('competition_authority_runs_cap_ticks_check', sql`${t.capTicks} > 0`),
}));
export const competitionAuthoritySessions = pgTable('competition_authority_sessions', {
  id: text('id').primaryKey(), runId: text('run_id').notNull().references(() => competitionAuthorityRuns.id),
  userId: text('user_id').notNull().references(() => users.id), controllerId: text('controller_id'),
  epoch: integer('epoch').notNull().default(0), nonceHash: text('nonce_hash'), status: text('status').notNull().default('CREATED'),
  terminalAt: timestamp('terminal_at', { withTimezone: true }),
}, t => ({
  runUser: uniqueIndex('competition_authority_sessions_run_id_user_id_key').on(t.runId, t.userId),
  statusCheck: check('competition_authority_sessions_status_check', sql`${t.status} in ('CREATED','READY','ACTIVE','COMPLETED','FORFEITED','VOIDED','EXPIRED')`),
}));
export const competitionAuthorityResults = pgTable('competition_authority_results', {
  id: text('id').primaryKey(), sessionId: text('session_id').notNull().unique().references(() => competitionAuthoritySessions.id),
  score: integer('score').notNull(), ticks: integer('ticks').notNull(), reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  scoreCheck: check('competition_authority_results_score_check', sql`${t.score} >= 0`),
  ticksCheck: check('competition_authority_results_ticks_check', sql`${t.ticks} >= 0`),
}));
export const competitionAuthorityDecisions = pgTable('competition_authority_decisions', {
  runId: text('run_id').primaryKey().references(() => competitionAuthorityRuns.id), kind: text('kind').notNull(),
  winnerUserId: text('winner_user_id').references(() => users.id), reason: text('reason').notNull(),
  resultIds: jsonb('result_ids').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), appliedAt: timestamp('applied_at', { withTimezone: true }),
}, t => ({
  kindCheck: check('competition_authority_decisions_kind_check', sql`${t.kind} in ('WIN','DRAW','VOID','FORFEIT')`),
  winnerCheck: check('competition_authority_decisions_check', sql`(${t.kind} in ('WIN','FORFEIT') and ${t.winnerUserId} is not null) or (${t.kind} in ('VOID','DRAW') and ${t.winnerUserId} is null)`),
}));
