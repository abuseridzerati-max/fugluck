// Competition Domain Types for Fugluck
// Implements the frozen specification: FUGLUCK — FINAL COMPETITION DOMAIN CONTRACT.
// All monetary values in paid competitions are represented in integer minor units (tetri/cents).

import type { ISO4217Currency } from "./money";
import { GAME_MANIFESTS } from "./games";

/** Competition currency: ISO-4217 monetary currencies or free virtual COINS (never mixed with MoneyAmount). */
export type CompetitionCurrency = ISO4217Currency | "COINS";

export type CompetitionFormat = "HEAD_TO_HEAD" | "TOURNAMENT_BRACKET" | "LEADERBOARD_RUSH";

export type CompetitionStatus =
  | "PENDING_ENTRANTS"
  | "LOCKED"
  | "ACTIVE"
  | "VERIFYING"
  | "SETTLED"
  | "CANCELLED"
  | "VOIDED";

export type CompetitionParticipantStatus =
  | "REGISTERED"
  | "PLAYING"
  | "SUBMITTED"
  | "FORFEITED"
  | "VOIDED"
  | "CANCELLED"
  | "DISCONNECTED";

export type GameCompetitionEligibility =
  | "FREE_PLAY_ONLY"
  | "COIN_COMPETITIVE"
  | "PAID_COMPETITIVE_CANDIDATE"
  | "PAID_COMPETITIVE_APPROVED";

export type GameEligibilityEntry = {
  gameId: string;
  eligibility: GameCompetitionEligibility;
  notes: string;
};

export type CompetitionCertification = {
  practice: true;
  casualCoins: boolean;
  testGelCompetition: "LEVEL_3_CERTIFIED" | "NOT_CERTIFIED" | "OUT_OF_SCOPE";
  authorityVersion?: string;
};

/** Single technical source of truth for current TEST GEL competition eligibility (derived from GAME_MANIFESTS). */
export const GAME_COMPETITION_CERTIFICATIONS: Record<string, CompetitionCertification> = Object.fromEntries(
  GAME_MANIFESTS.map((manifest) => [
    manifest.id,
    {
      practice: true as const,
      casualCoins: manifest.modes.includes("casual"),
      testGelCompetition: manifest.certified ? "LEVEL_3_CERTIFIED" : manifest.certificationScope,
      ...(manifest.authorityVersion ? { authorityVersion: manifest.authorityVersion } : {}),
    },
  ]),
);

// Architectural eligibility classifications per technical audit.
// Note: These classifications represent technical compatibility assessments (entropy, determinism,
// viewport letterboxing), NOT statutory or legal conclusions.
/** Compatibility projection for older read-only surfaces. Certification above is authoritative. */
export const GAME_COMPETITION_ELIGIBILITY_REGISTRY: Record<string, GameCompetitionEligibility> =
  Object.fromEntries(Object.entries(GAME_COMPETITION_CERTIFICATIONS).map(([gameId, certification]) => [
    gameId,
    certification.testGelCompetition === "LEVEL_3_CERTIFIED"
      ? "PAID_COMPETITIVE_CANDIDATE"
      : certification.testGelCompetition === "NOT_CERTIFIED"
        ? "FREE_PLAY_ONLY"
        : "COIN_COMPETITIVE",
  ])) as Record<string, GameCompetitionEligibility>;

export function isTestGelCompetitionCertified(gameId: string, rulesVersion?: string): boolean {
  const certification = GAME_COMPETITION_CERTIFICATIONS[gameId];
  return certification?.testGelCompetition === "LEVEL_3_CERTIFIED" &&
    (rulesVersion === undefined || certification.authorityVersion === rulesVersion);
}

export type CompetitionPrize = {
  placement: number;
  amountMinor: number;
  currency: CompetitionCurrency;
};

export type CompetitionTemplatePrize = {
  id: string;
  templateId: string;
  placement: number;
  amountMinor: number;
  currency: CompetitionCurrency;
};

export type CompetitionInstancePrize = {
  id: string;
  instanceId: string;
  placement: number;
  amountMinor: number;
  currency: CompetitionCurrency;
  awardedUserId?: string | null;
};

export type CompetitionTemplate = {
  tournament?: import('./tournaments').TournamentCardInfo;
  id: string;
  gameId: string;
  title: string;
  format: CompetitionFormat;
  participantCapacity: number;
  currency: CompetitionCurrency;
  entryFeeMinor: number;
  rulesVersion: string;
  skillAssessmentVersion: string;
  enabled: boolean;
  jurisdiction: string;
  createdAt: string;
  updatedAt: string;
  prizes?: CompetitionTemplatePrize[];
};

// CompetitionInstance snapshots all material competition and financial terms
// from its template upon creation so that subsequent template edits never alter
// existing instances.
export type CompetitionInstance = {
  id: string;
  templateId: string;
  gameId: string;
  format: CompetitionFormat;
  participantCapacity: number;
  currency: CompetitionCurrency;
  entryFeeMinor: number;
  rulesVersion: string;
  skillAssessmentVersion: string;
  jurisdiction: string;
  status: CompetitionStatus;
  currentParticipants: number;
  matchId?: string | null;
  winnerUserId?: string | null;
  lockedAt?: string | null;
  startedAt?: string | null;
  settledAt?: string | null;
  createdAt: string;
  prizes?: CompetitionInstancePrize[];
};

export type CompetitionParticipant = {
  id: string;
  instanceId: string;
  userId: string;
  seatIndex: number;
  entryFeeMinor: number;
  score?: number | null;
  rank?: number | null;
  prizeWonMinor: number;
  status: CompetitionParticipantStatus;
  registeredAt: string;
};
