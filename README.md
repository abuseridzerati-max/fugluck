# Fugluck

Fugluck is a competitive browser skill-gaming platform built on **Level 3 live server authority** — clients send control intent while the server owns physics, collisions, scoring, reconnects, and terminal outcomes.
The platform enforces strict dual-currency isolation between free non-monetary **COINS** (casual play and 2/4/8/16-player Coins Knockout Tournaments) and simulated **TEST / SANDBOX GEL** (zero real-world value, hidden from public UI by default).
Real-money payments, deposits, withdrawals, and commercial competitions remain hard-disabled (`REAL_MONEY_* = false`).

---

## Repository Map

| Path | Purpose |
|---|---|
| `packages/client/` | React 19 + Vite SPA (`@fugluck/client`), EN/KA/RU localization, player UX, and `/admin` Operator Console. |
| `packages/server/` | Express + Socket.IO + Drizzle ORM / PostgreSQL backend (`@fugluck/server`), Level 3 authority runtime, matchmaking, and double-entry ledgers. |
| `packages/shared/` | Shared TypeScript protocol types, currency/tournament rules, game registry, and policy versions (`@fugluck/shared`). |
| `packages/theme/` | Shared design tokens and category colors (`@fugluck/theme`). |
| `games/` | 6 active `1280×720` fixed-timestep browser games (`@fugluck/games`): **2 Level 3 Competition-Certified** (`space-blaster`, `cyber-hopper`) and **4 Casual / Practice** (`neon-runner`, `pixel-ninja-dash`, `speed-trivia`, `tf-sprint`). |
| `scripts/` | 56 automated verification suites (`npm test`) covering schema parity, authority, accounting, security, tournaments, i18n, and UI contracts. |
| `docs/` | Living engineering, deployment, and legal-readiness documentation. |

---

## Quickstart

**Prerequisites:** Node.js `>= 22.12.0`, `npm 11.21.1` (pinned via `packageManager`), and PostgreSQL 17.

```bash
# 1. Install dependencies
npm install

# 2. Configure local environment files
cp packages/server/.env.example packages/server/.env
cp packages/client/.env.example packages/client/.env.local

# 3. Apply all PostgreSQL migrations (0000 -> 0016)
npm run db:migrate

# 4. Run backend (port 4000) and frontend (port 5173) in separate terminals
npm run start:server
npm --workspace=@fugluck/client run dev
```

### Verification Commands

```bash
# Typecheck all workspaces + scripts + production Vite build
npm run typecheck

# Client lint
npm --workspace=@fugluck/client run lint

# Full 56-script isolated regression suite (requires explicit loopback TEST_DATABASE_URL)
npm test

# Read-only checks only (no database writes)
npm run test:read-only
```

---

## Living Documentation

- **[Architecture & Games](docs/ARCHITECTURE.md)** — Level 3 server authority, all 6 games & certification status, dual-currency isolation (`COINS` vs. `TEST GEL`), knockout bracket rules, and `Asia/Tbilisi` monthly allowance resets.
- **[Deployment Runbook](docs/DEPLOYMENT.md)** — Staging/Production setup, database backup & Drizzle migration checklist, environment variables, and Vercel/Render safety guards.
- **[Legal & Launch Readiness](docs/LEGAL_REVIEW_REQUIRED.md)** — Open regulatory, operator, privacy, translation, and payment/KYC gates required before commercial real-money launch.
