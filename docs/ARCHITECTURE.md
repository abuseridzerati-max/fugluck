# Fugluck — Architecture

> Code is the source of truth. This document describes the currently built architecture verified in `packages/` and `games/`.

---

## 1. Level 3 Live Server Authority

For competition-certified games, gameplay is **not** validated by trusting browser-reported scores or end-of-run replay uploads:

- **Client role:** Renders authoritative server snapshots on a letterboxed canonical `1280×720` canvas (`VIRTUAL_VIEWPORT` in `@fugluck/shared`) and emits permitted control intents.
- **Server role (`packages/server/src/competitions/authorityRuntime.ts`):** Owns the 60 FPS fixed-timestep simulation, deterministic seed, collision detection, scoring, controller reconnect ownership, admission RTT/jitter checks, and terminal settlement handoff.
- **Failure safety:** If infrastructure or lease uncertainty prevents a safe authoritative outcome, the runtime voids the match and releases/refunds entries rather than inventing a winner.
- **Casual play:** Practice and casual 1v1 Coins matches run locally with client-reported scores and have zero authority over `TEST GEL` or monetary prizes.

---

## 2. Game Catalog & Certification Status

All 6 active games run at a fixed 60 FPS timestep against the canonical `1280×720` virtual viewport (`packages/shared/src/gameModule.ts` & `packages/shared/src/competitions.ts`):

| Game | ID | Directory | Practice & Casual Coins | Coins Knockout & TEST GEL Competition |
|---|---|---|---|---|
| **Space Blaster** | `space-blaster` | `games/space-blaster/` | Active | **Level 3 Certified** (`space-blaster-rv001-v1`) |
| **Cyber Hopper** | `cyber-hopper` | `games/cyber-hopper/` | Active | **Level 3 Certified** (`cyber-hopper-rv001-v1`) |
| **Neon Runner** | `neon-runner` | `games/neon-runner/` | Active | Not certified |
| **Pixel Ninja Dash** | `pixel-ninja-dash` | `games/pixel-ninja-dash/` | Active | Not certified |
| **Speed Trivia Clash** | `speed-trivia` | `games/speed-trivia/` | Active | Out of prize scope |
| **True / False Sprint** | `tf-sprint` | `games/tf-sprint/` | Active | Out of prize scope |

---

## 3. Dual-Currency Isolation

Fugluck maintains **strict schema, accounting, and UI separation** between its two currencies. No conversion path exists between them.

### A. COINS (Free Non-Monetary Virtual Points)
- **Ledger:** Append-only `ledger_entries` (`currency = 'COINS'`), serialized per user via PostgreSQL advisory lock (`lockWalletUsers`) and non-negative balance triggers.
- **Signup grant:** `1,000 COINS` on registration (`SIGNUP_COIN_GRANT = 1000`).
- **Monthly allowance reset (`Asia/Tbilisi`, UTC+4):** On the first request of each Tbilisi calendar month (`00:00` on the 1st), users with `< 1,000 COINS` are topped up to exactly `1,000 COINS`; users with `>= 1,000 COINS` are left untouched.
- **Admin on-demand resets:** Operators with `WALLET_GRANT_COINS` can run the same `1,000 COINS` top-up rule anytime for a single user (`POST /api/admin/wallet/reset-coins`) or all users (`POST /api/admin/wallet/reset-coins-all`), fully idempotent and audit-logged.
- **Casual 1v1 matchmaking:** `0%` platform rake (`COINS_RAKE_PERCENT = 0`); guests are restricted to `stake = 0` (Free Play).

### B. TEST / SANDBOX GEL (Simulated Zero-Value Currency)
- **Ledger:** Isolated double-entry `sandbox_ledger_entries`, `sandbox_entry_reservations`, and `sandbox_settlements` tables (`currency = 'GEL'`, integer tetri minor units).
- **UI visibility:** Gated behind admin/operator roles (`OWNER`, `SUPER_ADMIN`, `ADMIN`, `MODERATOR`, `SUPPORT`) or explicit `VITE_SHOW_SANDBOX_GEL=true` (`packages/client/src/lib/sandboxVisibility.ts`). Regular signed-in players and guests see only the clean Coins experience.
- **Real-money hard disable:** `REAL_MONEY_ENABLED`, `REAL_MONEY_DEPOSITS_ENABLED`, `REAL_MONEY_WITHDRAWALS_ENABLED`, and `REAL_MONEY_COMPETITIONS_ENABLED` are enforced `false` across startup validation, health checks, and routes.

---

## 4. Knockout Tournament Rules

Both certified games (`Space Blaster`, `Cyber Hopper`) share the server-authoritative single-elimination knockout engine (`packages/server/src/competitions/tournamentService.ts` & `tournamentRules.ts`):

- **Coins Knockout Tournaments (`currency = 'COINS'`):**
  - **Brackets:** 2, 4, 8, and 16-player `STANDARD` knockout formats (`100 Coins` entry, `0%` rake, `100%` of pot to champion: `200 / 400 / 800 / 1,600 Coins`).
  - **No promotionals:** DB-level `CHECK` constraints (`0015_coin_tournaments.sql`) forbid `PROMO`/`GIFT` products and qualification cycles for `COINS`.
  - **Accounting:** Isolated `CoinTournamentAccountingAdapter` (`coin_tournament_reservations`, `coin_tournament_settlements`, `ledger_entries`); single upfront entry capture, Final-only settlement, zero spillover into GEL tables.
- **TEST GEL Knockout Tournaments (`currency = 'GEL'`):**
  - **Brackets:** 2, 4, 8, and 16-player `STANDARD` (90/10 frozen terms) plus scheduled `PROMO` (Wednesday) and `GIFT` (Sunday) qualification tracks on `Asia/Tbilisi` cycles with a 5-minute pre-start cutoff.
  - **Integrity:** One entry capture per tournament, no BYEs, deterministic server seeding, idempotent Final-only settlement, and persisted attempt recovery across server restarts.

---

## 5. Database Migrations & Security Boundaries

- **Migration chain (`packages/server/drizzle/`):** 17 sequential migrations (`0000_early_marrow` through `0016_restrict_currency_coins_gel`), verified at server startup via exact SHA-256 hash comparison (`enforceMigrationIdentity()`).
- **Auth & Sessions:** HttpOnly/SameSite `ac_session` cookies, durable logout/password-change revocation (`0014_security_boundaries.sql`), short-lived purpose-scoped competition socket tickets, and strict Origin/CORS + proxy-aware rate limiting (`TRUST_PROXY=render` in hosted ingress).
- **Admin Console (`/admin`):** Separate operator session cookie (`ac_admin_session`), IP login lockout, granular RBAC (`OWNER`, `SUPER_ADMIN`, `ADMIN`, `MODERATOR`, `SUPPORT`), and immutable `admin_audit_logs`.
