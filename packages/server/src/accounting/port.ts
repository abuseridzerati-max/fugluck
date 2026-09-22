// Competition Accounting Port (Fugluck Competition Economy — Phase 2)
// Implements FUGLUCK — FINAL COMPETITION DOMAIN CONTRACT
// Defines a provider-independent interface for all financial interactions of the Competition domain.
// Competition logic must interact with money exclusively through this abstraction, never depending
// directly on specific payment gateways, banks, wallets, or legacy virtual currencies.

import type { MoneyAmount } from "@fugluck/shared";

export interface ReserveEntryParams {
  competitionInstanceId: string;
  userId: string;
  entryFee: MoneyAmount;
  idempotencyKey: string;
}

export interface ReserveEntryResult {
  success: boolean;
  accountingReferenceId?: string;
  competitionInstanceId: string;
  userId: string;
  reservedAmount: MoneyAmount;
  errorCode?: "INSUFFICIENT_FUNDS" | "DUPLICATE_ENTRY" | "INVALID_AMOUNT" | "INVALID_CURRENCY" | "INTERNAL_ERROR";
  errorMessage?: string;
}

export interface ReleaseEntryParams {
  competitionInstanceId: string;
  userId: string;
  idempotencyKey: string;
}

export interface ReleaseEntryResult {
  success: boolean;
  accountingReferenceId?: string;
  competitionInstanceId: string;
  userId: string;
  releasedAmount?: MoneyAmount;
  errorCode?: "RESERVATION_NOT_FOUND" | "ALREADY_CAPTURED" | "INTERNAL_ERROR";
  errorMessage?: string;
}

export interface CaptureEntryParams {
  competitionInstanceId: string;
  userId: string;
  idempotencyKey: string;
}

export interface CaptureEntryResult {
  success: boolean;
  accountingReferenceId?: string;
  competitionInstanceId: string;
  userId: string;
  capturedAmount?: MoneyAmount;
  errorCode?: "RESERVATION_NOT_FOUND" | "ALREADY_RELEASED" | "INTERNAL_ERROR";
  errorMessage?: string;
}

export interface PrizeAward {
  placement: number;
  userId: string;
  amount: MoneyAmount;
}

export interface SettleCompetitionParams {
  competitionInstanceId: string;
  prizes: PrizeAward[];
  idempotencyKey: string;
}

export interface SettleCompetitionResult {
  success: boolean;
  accountingReferenceId?: string;
  competitionInstanceId: string;
  totalEntriesCaptured: MoneyAmount;
  totalPrizesAwarded: MoneyAmount;
  platformMarginRetained?: MoneyAmount;
  promotionalSubsidyInjected?: MoneyAmount;
  prizesAwarded: PrizeAward[];
  errorCode?: "COMPETITION_ALREADY_SETTLED" | "COMPETITION_ALREADY_REFUNDED" | "INVALID_PRIZE_AMOUNT" | "INTERNAL_ERROR";
  errorMessage?: string;
}

export interface RefundCompetitionParams {
  competitionInstanceId: string;
  reason: string;
  idempotencyKey: string;
}

export interface RefundCompetitionResult {
  success: boolean;
  accountingReferenceId?: string;
  competitionInstanceId: string;
  totalRefunded: MoneyAmount;
  refundedUserIds: string[];
  errorCode?: "COMPETITION_ALREADY_SETTLED" | "COMPETITION_ALREADY_REFUNDED" | "INTERNAL_ERROR";
  errorMessage?: string;
}

export interface CompetitionAccountingPort {
  reserveEntry(params: ReserveEntryParams): Promise<ReserveEntryResult>;
  releaseEntry(params: ReleaseEntryParams): Promise<ReleaseEntryResult>;
  captureEntry(params: CaptureEntryParams): Promise<CaptureEntryResult>;
  settleCompetition(params: SettleCompetitionParams): Promise<SettleCompetitionResult>;
  refundCompetition(params: RefundCompetitionParams): Promise<RefundCompetitionResult>;
}
