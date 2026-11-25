# Fugluck — Historical Legal, Regulatory & Policy Review Register

> **Status:** HISTORICAL AUDIT SNAPSHOT — superseded for current product status
> **Snapshot date:** 2026-08-18
> **Purpose:** Centralized internal tracking of open regulatory, licensing, financial, and jurisdictional determinations. No definitive factual or statutory claims regarding these items are to be hardcoded into user-facing copy without formal legal confirmation.

> **Current-status note (2026-11-24):** Current active currencies are free non-monetary COINS (casual play and Coins knockout tournaments) and simulated TEST / SANDBOX GEL (zero real-world value). Current source-verified product status is documented in [`docs/PHASE_6C_REVENUE_SERVICE_DOSSIER.md`](docs/PHASE_6C_REVENUE_SERVICE_DOSSIER.md). The missing public-content/legal inputs are tracked in [`docs/PUBLIC_CONTENT_RELEASE_CHECKLIST.md`](docs/PUBLIC_CONTENT_RELEASE_CHECKLIST.md). Unresolved regulatory/legal items remain unresolved.

---

## 1. Regulatory & Licensing Determinations

| Item | Current System Status | Open Legal / Compliance Determination | Action Needed Before Real-Money Launch |
| :--- | :--- | :--- | :--- |
| **Skill-Gaming Classification** | Level 3 server-authoritative competition runtime for certified games (`Space Blaster`, `Cyber Hopper`). | Formal jurisdictional classification of Fugluck mini-games under skill-based gaming vs prize gaming vs gambling statutes in primary target markets (e.g. Georgia, EU, UK). | Obtain legal opinion letters per operating territory confirming skill-game status. |
| **Platform Licensing** | Platform code makes zero claims of specific gaming or lottery licenses. | Determine whether operating as a skill gaming operator requires a specific contest/skill-gaming license, corporate registration, or notification in target jurisdictions. | Consult gaming regulatory counsel. |
| **Tax Treatment of Winnings** | Platform tracks entry fees and predetermined prizes in double-entry PostgreSQL ledgers. | Tax reporting obligations (e.g. local Georgian tax rules, DAC7 in EU, withholding rules) on player competition prizes. | Retain tax advisor for gaming platform reporting rules. |

---

## 2. Eligibility & Age Restrictions

| Item | Current System Status | Open Legal / Compliance Determination | Action Needed Before Real-Money Launch |
| :--- | :--- | :--- | :--- |
| **Minimum Age** | Policy text specifies "legal age to form a binding contract and participate in skill-based competitions in your jurisdiction." | Determine hard minimum age threshold (e.g. 18+ vs 21+) for free COINS vs future real-money GEL competitions. | Update registration gate and age verification rules once counsel confirms. |
| **Geographical Restrictions** | Policy mentions general compliance with applicable local laws and reservation of rights to block restricted/sanctioned territories. | Finalize explicit list of permitted vs restricted countries/states. | Configure geo-IP blocking middleware and terms country list. |

---

## 3. Financial, KYC & Payment Rules

| Item | Current System Status | Open Legal / Compliance Determination | Action Needed Before Real-Money Launch |
| :--- | :--- | :--- | :--- |
| **Currency & Pricing** | Sandbox competitions operate in simulated `TEST GEL` (tetri minor units); real-money switches are hard-disabled. | Final commercial GEL entry fee / prize tiers and fee disclosures. | Set production pricing matrix upon payment processor onboarding. |
| **KYC / AML Thresholds** | `policy_acceptances` table records user consent timestamps, IPs, and policy versions. | Specific cumulative withdrawal or deposit amount triggering mandatory identity verification under AML directives. | Integrate KYC verification provider (e.g. Sumsub, Persona, Veriff). |
| **Withdrawal Limits & Timelines** | Real-money withdrawals are disabled (`REAL_MONEY_WITHDRAWALS_ENABLED=false`). | Minimum withdrawal amount, maximum daily/monthly cash-out limit, processing SLA, and payout fee structure. | Configure withdrawal thresholds in server environment config. |
| **Playthrough / AML Rules** | Deposits and withdrawals are disabled in the current build. | Anti-money laundering rules for deposited funds vs won competition prizes before withdrawal eligibility. | Implement counsel-approved AML checks in commercial withdrawal validation. |
| **Payment Processors** | No real payment provider adapter is active. | Selection and contract execution with merchant acquiring and payout partners. | Implement provider-specific adapter adhering to `PaymentProvider` interface. |

---

## 4. Policy Versioning & Acceptance Tracking

- **Current Mandatory Policy Versions:**
  - `TERMS`: `draft-1.0`
  - `PRIVACY`: `draft-1.0`
  - `COOKIES`: `2026-08-18`
  - `RULES`: `draft-1.0`
  - `WITHDRAWALS`: `2026-08-18`
  - `REFUNDS`: `2026-08-18`
  - `RESPONSIBLE_PLAY`: `2026-08-18`
  - `ELIGIBILITY`: `2026-08-18`
  - `FAIR_PLAY`: `draft-1.0`
  - `DISPUTES`: `2026-08-18`
  - `DATA_RIGHTS`: `2026-08-18`
  - `SECURITY`: `2026-08-18`
  - `ABOUT`: `draft-1.0`
  - `CONTACT`: `draft-1.0`
  - `SANDBOX_NOTICE`: `draft-1.0`
- **Durable Database Audit:** All registrations record IP, User-Agent, Policy Type, and Version in `policy_acceptances`.
