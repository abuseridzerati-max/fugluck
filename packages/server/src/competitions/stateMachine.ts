// Competition State Machine (Fugluck Competition Economy — Phase 3)
// Implements FUGLUCK — FINAL COMPETITION DOMAIN CONTRACT Section 12
// Enforces server-authoritative, legal state transitions for CompetitionInstances.

import type { CompetitionStatus } from "@fugluck/shared";

export class InvalidStateTransitionError extends Error {
  constructor(public readonly currentStatus: CompetitionStatus, public readonly targetStatus: CompetitionStatus) {
    super(`Invalid competition state transition: cannot transition from ${currentStatus} to ${targetStatus}`);
    this.name = "InvalidStateTransitionError";
  }
}

/**
 * Valid state transition map:
 * PENDING_ENTRANTS -> LOCKED, CANCELLED
 * LOCKED           -> ACTIVE, VOIDED
 * ACTIVE           -> VERIFYING, SETTLED, VOIDED
 * VERIFYING        -> SETTLED, VOIDED
 * SETTLED          -> (terminal)
 * CANCELLED        -> (terminal)
 * VOIDED           -> (terminal)
 */
export const ALLOWED_STATE_TRANSITIONS: Record<CompetitionStatus, readonly CompetitionStatus[]> = {
  PENDING_ENTRANTS: ["LOCKED", "CANCELLED"],
  LOCKED: ["ACTIVE", "VOIDED"],
  ACTIVE: ["VERIFYING", "SETTLED", "VOIDED"],
  VERIFYING: ["SETTLED", "VOIDED"],
  SETTLED: [],
  CANCELLED: [],
  VOIDED: [],
} as const;

export function canTransitionCompetition(
  current: CompetitionStatus,
  target: CompetitionStatus,
): boolean {
  if (current === target) return false;
  const allowed = ALLOWED_STATE_TRANSITIONS[current] ?? [];
  return allowed.includes(target);
}

export function assertValidTransition(
  current: CompetitionStatus,
  target: CompetitionStatus,
): void {
  if (!canTransitionCompetition(current, target)) {
    throw new InvalidStateTransitionError(current, target);
  }
}

export function isTerminalStatus(status: CompetitionStatus): boolean {
  return status === "SETTLED" || status === "CANCELLED" || status === "VOIDED";
}
