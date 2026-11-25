# Fugluck — Deployment Runbook

> Frontend deploys to **Vercel** (`packages/client`), backend API & Socket.IO deploy to **Render** (`packages/server`), and PostgreSQL runs on **Supabase** (staging isolated in Frankfurt).

---

## 1. Deployment Safety Guards

- **Vercel Production Auto-Deploy is OFF:** `packages/client/vercel.json` sets `"git": { "deploymentEnabled": { "main": false } }`. Pushing to `main` does **not** auto-deploy Production.
- **Render Auto-Deploy is OFF:** `render.yaml` sets `autoDeploy: false`. Backend deploys are always intentional.
- **Real Money Hard-Disabled:** All `REAL_MONEY_*` switches must remain `false` (or unset) until external legal, payment-provider, and Production-isolation gates in [`LEGAL_REVIEW_REQUIRED.md`](LEGAL_REVIEW_REQUIRED.md) are formally closed.
- **Startup Migration Identity Guard:** The server refuses to start if `drizzle.__drizzle_migrations` does not match all **17** expected migrations (`0000_early_marrow` → `0016_restrict_currency_coins_gel`) by exact SHA-256 hash.

---

## 2. Environment Variables

### Backend (`packages/server/.env` / Render)

| Variable | Required | Staging Value | Notes |
|---|---|---|---|
| `DATABASE_URL` | **Yes** (Secret) | Staging PostgreSQL URI | Must be strictly isolated from Production |
| `JWT_SECRET` | **Yes** (Secret) | 64-char random hex | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NODE_ENV` | **Yes** | `production` | Sets Node runtime mode and secure cookie defaults |
| `APP_ENV` | **Yes** | `staging` (deployment identity; independent of Node runtime mode) | Separates staging deployment identity from Node runtime mode |
| `PORT` | Auto | `10000` (Render) / `4000` (local) | HTTP + Socket.IO listen port (`0.0.0.0`) |
| `CLIENT_ORIGIN` | **Yes** | `https://staging.fugluck.com` | Primary CORS origin for credentialed cookies |
| `ALLOWED_ORIGINS` | **Yes** | `https://staging.fugluck.com` | Comma-separated CORS & WebSocket origin allowlist |
| `APP_URL` | **Yes** | `https://staging.fugluck.com` | Base URL for verification & password-reset links |
| `COOKIE_DOMAIN` | Optional | *(empty)* | Leave empty in hosted envs for host-only API cookies |
| `COOKIE_SAMESITE` | Optional | `lax` | Cookie SameSite attribute (`lax` / `none`) |
| `TRUST_PROXY` | Optional | `render` | Use `false` locally, `render` behind Render ingress |
| `ENABLE_COMPETITION_AUTHORITY` | Optional | `true` | Enables Level 3 live competition authority |
| `ENABLE_KNOCKOUT_TOURNAMENTS` | Optional | `true` | Enables 2/4/8/16 knockout tournaments |
| `ENABLE_COIN_TOURNAMENTS` | Optional | `true` | Enables free Coins Knockout Tournaments (default on when authority is enabled) |
| `REAL_MONEY_ENABLED` | Safety | `false` | Hard-disabled in this release |
| `REAL_MONEY_DEPOSITS_ENABLED` | Safety | `false` | Hard-disabled in this release |
| `REAL_MONEY_WITHDRAWALS_ENABLED` | Safety | `false` | Hard-disabled in this release |
| `REAL_MONEY_COMPETITIONS_ENABLED` | Safety | `false` | Hard-disabled in this release |
| `EMAIL_PROVIDER` | Optional | `logger` | `logger` (staging), `resend`, or `smtp` (required for Production) |
| `EMAIL_FROM` | Optional | `Fugluck Staging <no-reply@fugluck.com>` | Sender address for transactional emails |

### Frontend (`packages/client/.env.local` / Vercel)

| Variable | Required | Staging Value | Notes |
|---|---|---|---|
| `VITE_API_URL` | **Yes** | `https://api-staging.fugluck.com` | Public backend API & Socket.IO origin |
| `VITE_APP_ENV` | Optional | `staging` | Client deployment identity |
| `VITE_SHOW_SANDBOX_GEL` | Optional | `false` | Set `true` only to expose `TEST / SANDBOX GEL` UI to non-admin users |

---

## 3. Database Backup & Migration Checklist

Before deploying any schema change (including `0015_coin_tournaments` and `0016_restrict_currency_coins_gel`) to staging or Production:

1. **Take a verified database backup** (provider snapshot + `pg_dump` verified against an isolated restore).
2. **Confirm zero active authority runs or open reservations** via `/admin` → **Operations / Health**.
3. **Apply migrations using the official Drizzle migrator:**
   ```bash
   npm run db:migrate
   ```
4. **Verify migration identity & health** immediately after deploy:
   - `GET /api/health` returns `ok: true`, `database: "connected"`, `migrations: "match"`, and `commercial.moneyEnabled: false`.
   - `GET /api/admin/operations` confirms `expectedCount: 17`, `appliedCount: 17`, `expectedHead: "0016_restrict_currency_coins_gel"`.

---

## 4. Post-Deploy Smoke Verification

- [ ] **SPA Deep Links:** Hard-refresh (`F5`) on `/`, `/competitions`, `/wallet`, `/profile`, `/terms`, `/privacy`, `/help`, `/faq`, `/admin`, and an unknown route (`/404-check`).
- [ ] **Auth & Coins:** Sign up a test account, confirm `1,000 COINS` grant, verify session persists across `F5`, and confirm logout revokes the session.
- [ ] **Public UI Gating:** Confirm regular signed-in users and guests see only Coins in the navbar and `/competitions` (no `TEST / SANDBOX GEL` clutter unless signed in as an admin or `VITE_SHOW_SANDBOX_GEL=true`).
- [ ] **Competitions & Admin:** Launch a Coins tournament room on Space Blaster / Cyber Hopper; verify `/admin` login, Operations health, and single-user/global 1,000-Coin reset controls.
- [ ] **Financial Safety:** Confirm `/api/health` reports all real-money switches `false` and no real-money deposit/withdrawal form exists.

---

## 5. Production Pre-Launch Technical Blockers

Before opening Production to external users:
1. Isolate Production frontend, API, and PostgreSQL database completely from staging.
2. Replace `EMAIL_PROVIDER=logger` with verified `resend` or `smtp` delivery (SPF/DKIM/DMARC).
3. Enforce Production CSP, monitoring/alerting, automated backup/DR drills, and distributed rate limiting prior to horizontal scaling.
