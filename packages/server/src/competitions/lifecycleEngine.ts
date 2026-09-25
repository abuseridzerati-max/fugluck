// Competition Lifecycle Engine (Fugluck Competition Economy — Phase 3)
// Implements FUGLUCK — FINAL COMPETITION DOMAIN CONTRACT Sections 8, 13, 14, 15, 16, 17, 18, 19
// Coordinates match creation, authority decisions, snapshotted prize settlement,
// tie refunds, forfeit handling, cancellation, rematching, and crash recovery.

import { randomInt, randomUUID } from "node:crypto";
import { asc, eq, or } from "drizzle-orm";
import type { ISO4217Currency } from "@fugluck/shared";
import type { CompetitionAccountingPort } from "../accounting/port";
import { SandboxAccountingAdapter } from "../accounting/sandboxAdapter";
import { db, pool } from "../db/client";
import {
  competitionInstancePrizes,
  competitionInstances,
  competitionParticipants,
  matchesHistory,
} from "../db/schema";
import { instanceService } from "./instanceService";
import { assertValidTransition } from "./stateMachine";

export const COMPETITION_WAITING_TIMEOUT_MS = 120_000;

class AsyncMutex {
  private queue = new Map<string, Promise<void>>();

  async runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.queue.get(key) ?? Promise.resolve();
    let release: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.queue.set(key, previous.then(() => current, () => current));
    await previous.catch(() => {});

    try {
      return await fn();
    } finally {
      release!();
      if (this.queue.get(key) === current) {
        this.queue.delete(key);
      }
    }
  }
}

export const lifecycleMutex = new AsyncMutex();

export class CompetitionLifecycleError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "CompetitionLifecycleError";
  }
}

export class CompetitionLifecycleEngine {
  constructor(private readonly defaultAccountingPort: CompetitionAccountingPort = new SandboxAccountingAdapter()) {}

  /**
   * Activates a LOCKED competition instance:
   * 1. Captures all reserved entries via CompetitionAccountingPort.
   * 2. Generates server-authoritative seed.
   * 3. Creates matches_history record linked via competition_instance_id.
   * 4. Binds matchId to competition_instances and transitions status to ACTIVE.
   */
  async activateLockedCompetition(
    instanceId: string,
    accountingPort: CompetitionAccountingPort = this.defaultAccountingPort,
  ): Promise<{
    matchId: string;
    seed: number;
    gameId: string;
    player1Id: string;
    player2Id: string;
  }> {
    return await lifecycleMutex.runExclusive(`activate:${instanceId}`, async () => {
      // 1. Fetch instance
      const instRows = await pool.query(
        `SELECT id, game_id, format, participant_capacity, currency, entry_fee_minor, status, match_id
         FROM competition_instances WHERE id = $1`,
        [instanceId],
      );

      if (instRows.rows.length === 0) {
        throw new CompetitionLifecycleError("INSTANCE_NOT_FOUND", `Instance ${instanceId} not found.`);
      }
      const instance = instRows.rows[0];

      if (instance.status === "ACTIVE" && instance.match_id) {
        const pRows = await pool.query(
          `SELECT user_id FROM competition_participants WHERE instance_id = $1 ORDER BY seat_index ASC`,
          [instanceId],
        );
        return {
          matchId: instance.match_id,
          seed: 0,
          gameId: instance.game_id,
          player1Id: pRows.rows[0]?.user_id ?? "",
          player2Id: pRows.rows[1]?.user_id ?? "",
        };
      }

      if (instance.status !== "LOCKED") {
        throw new CompetitionLifecycleError(
          "INVALID_INSTANCE_STATUS",
          `Instance ${instanceId} is in status ${instance.status}, expected LOCKED.`,
        );
      }

      // 2. Fetch participants
      const partRows = await pool.query(
        `SELECT user_id, seat_index FROM competition_participants WHERE instance_id = $1 ORDER BY seat_index ASC`,
        [instanceId],
      );
      const participants = partRows.rows;

      if (participants.length !== Number(instance.participant_capacity)) {
        throw new CompetitionLifecycleError(
          "CAPACITY_MISMATCH",
          `Instance has ${participants.length} participants, expected ${instance.participant_capacity}.`,
        );
      }

      // 3. Capture entries for all participants
      for (const p of participants) {
        const capResult = await accountingPort.captureEntry({
          competitionInstanceId: instanceId,
          userId: p.user_id,
          idempotencyKey: `comp_cap_${instanceId}_${p.user_id}`,
        });

        if (!capResult.success) {
          console.error(`[lifecycle] Capture failed for user ${p.user_id} in instance ${instanceId}:`, capResult);
          await accountingPort.refundCompetition({
            competitionInstanceId: instanceId,
            reason: `CAPTURE_FAILURE_${p.user_id}`,
            idempotencyKey: `comp_cap_fail_refund_${instanceId}`,
          });
          await pool.query(
            `UPDATE competition_instances SET status = 'VOIDED', settled_at = NOW() WHERE id = $1`,
            [instanceId],
          );
          throw new CompetitionLifecycleError(
            "CAPTURE_FAILED",
            `Failed to capture entry for user ${p.user_id}; competition voided.`,
          );
        }
      }

      // 4. Generate seed & match
      const seed = randomInt(1, 2_147_483_647);
      const matchId = `comp_match_${randomUUID()}`;

      await pool.query(
        `INSERT INTO matches_history (
          id, game_id, player1_id, player2_id, competition_instance_id, currency, stake, seed, status, started_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', NOW())`,
        [
          matchId,
          instance.game_id,
          participants[0].user_id,
          participants[1].user_id,
          instanceId,
          instance.currency,
          instance.entry_fee_minor,
          seed,
        ],
      );

      assertValidTransition(instance.status, "ACTIVE");
      await pool.query(
        `UPDATE competition_instances SET status = 'ACTIVE', match_id = $1, started_at = NOW() WHERE id = $2`,
        [matchId, instanceId],
      );

      await pool.query(
        `UPDATE competition_participants SET status = 'PLAYING' WHERE instance_id = $1`,
        [instanceId],
      );

      return {
        matchId,
        seed,
        gameId: instance.game_id,
        player1Id: participants[0].user_id,
        player2Id: participants[1].user_id,
      };
    });
  }

  /**
   * Legacy client score submissions cannot advance the TEST GEL lifecycle.
   */
  async submitScore(
    _params: unknown,
    _accountingPort: CompetitionAccountingPort = this.defaultAccountingPort,
  ): Promise<never> {
    throw new CompetitionLifecycleError(
      "LIVE_AUTHORITY_REQUIRED",
      "Client scores cannot complete TEST GEL competitions; a certified live authority decision is required.",
    );
  }
  /**
   * Settles a competition instance authoritatively.
   * Handles:
   * - Winner resolution from snapshotted prize schedule
   * - Exact tie refund (DRAW/VOID) with full refund
   * - Forfeits
   * - System void refunds
   * Idempotent against repeat triggers.
   */
  async settleCompetition(
    instanceId: string,
    options: {
      forfeitingUserId?: string;
      systemVoid?: boolean;
      voidReason?: string;
    } = {},
    accountingPort: CompetitionAccountingPort = this.defaultAccountingPort,
  ): Promise<{
    status: string;
    outcome: string;
    winnerUserId?: string | null;
  }> {
    return await lifecycleMutex.runExclusive(`settle:${instanceId}`, async () => {
      const authorityRun = (await pool.query('SELECT id FROM competition_authority_runs WHERE instance_id=$1', [instanceId])).rows[0];
      if (authorityRun) {
        if (!options.systemVoid) throw new CompetitionLifecycleError('LIVE_AUTHORITY_REQUIRED', 'Authority decisions own settlement and recovery.');
        const { AuthorityStore } = await import('./authorityStore');
        const result = await new AuthorityStore(undefined, accountingPort).decide(authorityRun.id, options.voidReason ?? 'ADMINISTRATIVE_VOID', undefined, true, false, true);
        return { status: result.status, outcome: result.reason, winnerUserId: result.winnerUserId };
      }
      if (!options.systemVoid) {
        throw new CompetitionLifecycleError('LIVE_AUTHORITY_REQUIRED', 'A durable Level 3 authority run is required before any competition settlement.');
      }

      const instRows = await pool.query(`SELECT id, status, match_id FROM competition_instances WHERE id = $1`, [instanceId]);
      const instance = instRows.rows[0];
      if (!instance) throw new CompetitionLifecycleError('INSTANCE_NOT_FOUND', `Instance ${instanceId} not found.`);
      if (["SETTLED", "VOIDED", "CANCELLED"].includes(instance.status)) {
        return { status: instance.status, outcome: instance.status, winnerUserId: null };
      }
      const reason = options.voidReason ?? "SYSTEM_VOID";
      await accountingPort.refundCompetition({ competitionInstanceId: instanceId, reason, idempotencyKey: `comp_void_${instanceId}` });
      await pool.query(`UPDATE competition_instances SET status='VOIDED', winner_user_id=NULL, settled_at=NOW() WHERE id=$1`, [instanceId]);
      await pool.query(`UPDATE competition_participants SET status='VOIDED', rank=NULL, prize_won_minor=0 WHERE instance_id=$1`, [instanceId]);
      if (instance.match_id) {
        await pool.query(`UPDATE matches_history SET winner_id=NULL, status='VOIDED', status_reason=$1, ended_at=NOW() WHERE id=$2`, [reason, instance.match_id]);
      }
      return { status: "VOIDED", outcome: "VOIDED", winnerUserId: null };    });
  }

  /**
   * Cancels an unfilled PENDING_ENTRANTS competition instance (e.g. on waiting timeout).
   * Releases any reserved entry funds safely.
   */
  async cancelUnfilledInstance(
    instanceId: string,
    accountingPort: CompetitionAccountingPort = this.defaultAccountingPort,
    _reason: string = "WAITING_TIMEOUT",
  ): Promise<{ instanceId: string; cancelled: boolean }> {
    return await lifecycleMutex.runExclusive(`cancel:${instanceId}`, async () => {
      const instRows = await pool.query(
        `SELECT id, status FROM competition_instances WHERE id = $1`,
        [instanceId],
      );

      if (instRows.rows.length === 0) return { instanceId, cancelled: false };
      const inst = instRows.rows[0];

      if (inst.status === "CANCELLED") return { instanceId, cancelled: true };
      if (inst.status !== "PENDING_ENTRANTS") return { instanceId, cancelled: false };

      const partRows = await pool.query(
        `SELECT user_id FROM competition_participants WHERE instance_id = $1`,
        [instanceId],
      );

      for (const p of partRows.rows) {
        await accountingPort.releaseEntry({
          competitionInstanceId: instanceId,
          userId: p.user_id,
          idempotencyKey: `comp_cancel_rel_${instanceId}_${p.user_id}`,
        });
      }

      await pool.query(`UPDATE competition_instances SET status = 'CANCELLED' WHERE id = $1`, [instanceId]);
      await pool.query(`UPDATE competition_participants SET status='CANCELLED', rank=NULL, prize_won_minor=0 WHERE instance_id=$1`, [instanceId]);

      return { instanceId, cancelled: true };
    });
  }

  /**
   * Crash & Orphan Recovery:
   * Inspects non-terminal instances on boot:
   * - PENDING_ENTRANTS -> Releases reservations, marks CANCELLED.
   * - LOCKED, ACTIVE, VERIFYING -> Refunds captured entries via refundCompetition, marks VOIDED.
   * Idempotent across restarts.
   */
  async recoverOrphanCompetitions(
    accountingPort: CompetitionAccountingPort = this.defaultAccountingPort,
  ): Promise<{ recoveredPending: number; recoveredActive: number }> {
    const nonTerminalRows = await db
      .select()
      .from(competitionInstances)
      .where(
        or(
          eq(competitionInstances.status, "PENDING_ENTRANTS"),
          eq(competitionInstances.status, "LOCKED"),
          eq(competitionInstances.status, "ACTIVE"),
          eq(competitionInstances.status, "VERIFYING"),
        ),
      );

    let recoveredPending = 0;
    let recoveredActive = 0;

    for (const inst of nonTerminalRows) {
      if ((await pool.query('SELECT 1 FROM competition_authority_runs WHERE instance_id=$1', [inst.id])).rowCount) continue;
      try {
        if (inst.status === "PENDING_ENTRANTS") {
          await this.cancelUnfilledInstance(inst.id, accountingPort, "CRASH_RECOVERY");
          recoveredPending++;
        } else {
          await this.settleCompetition(
            inst.id,
            { systemVoid: true, voidReason: "SERVER_RESTART_ORPHAN_RECOVERY" },
            accountingPort,
          );
          recoveredActive++;
        }
      } catch (err) {
        console.error(`[lifecycle] Failed to recover orphan competition ${inst.id}:`, err);
      }
    }

    return { recoveredPending, recoveredActive };
  }
}

export const lifecycleEngine = new CompetitionLifecycleEngine();
