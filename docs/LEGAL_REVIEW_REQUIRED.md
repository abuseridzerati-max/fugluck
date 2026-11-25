# Fugluck — Legal, Regulatory & Launch Readiness Register

> **Audience:** Fugluck product, engineering, and legal reviewers (internal only — do not render as public website copy).
> **Status:** Open external inputs required before commercial real-money launch. No legal classification, licence, regulator approval, or Revenue Service decision is claimed by this repository.

Current active currencies in code are free non-monetary **COINS** (casual play and Coins Knockout Tournaments) and simulated **TEST / SANDBOX GEL** (zero real-world value). All real-money switches (`REAL_MONEY_*`) are hard-disabled.

---

## 1. Regulatory & Licensing Determinations

| Item | Current System Status | Open Legal / Compliance Determination | Action Needed Before Real-Money Launch |
| :--- | :--- | :--- | :--- |
| **Skill-Gaming Classification** | Level 3 server-authoritative competition runtime for certified games (`Space Blaster`, `Cyber Hopper`). | Formal jurisdictional classification of Fugluck games under skill-based gaming vs. prize gaming vs. gambling statutes in primary target markets (Georgia, EU, UK). | Obtain legal opinion letters per operating territory confirming skill-game status. |
| **Platform Licensing** | Code makes zero claims of specific gaming or lottery licenses. | Determine whether operating as a skill-gaming operator requires a specific licence, corporate registration, or regulatory notification. | Consult gaming regulatory counsel. |
| **Tax Treatment of Winnings** | Double-entry PostgreSQL ledgers track entry fees and predetermined prizes. | Tax reporting and withholding obligations (local Georgian tax rules, DAC7 in EU, etc.) on player competition prizes. | Retain tax advisor for gaming platform reporting rules. |

---

## 2. Eligibility & Age Restrictions

| Item | Current System Status | Open Legal / Compliance Determination | Action Needed Before Real-Money Launch |
| :--- | :--- | :--- | :--- |
| **Minimum Age** | Policy drafts specify legal age to form a binding contract and participate in skill-based competitions. | Confirm hard minimum age threshold (e.g. 18+ vs. 21+) for free COINS vs. future real-money GEL competitions. | Update registration gate and age verification rules once counsel confirms. |
| **Geographical Restrictions** | Policy drafts reserve rights to block restricted or sanctioned territories. | Finalize explicit list of permitted vs. restricted countries/jurisdictions. | Configure geo-IP blocking middleware and publish final territory list. |

---

## 3. Financial, KYC & Payment Rules

| Item | Current System Status | Open Legal / Compliance Determination | Action Needed Before Real-Money Launch |
| :--- | :--- | :--- | :--- |
| **Currency & Pricing** | Sandbox competitions use simulated `TEST GEL` (tetri minor units); real-money switches are hard-disabled. | Final commercial GEL entry fee / prize tiers and fee disclosures. | Set production pricing matrix upon payment-provider onboarding. |
| **KYC / AML Thresholds** | `policy_acceptances` table records user consent timestamps, IPs, and policy versions. | Cumulative deposit/withdrawal thresholds triggering mandatory identity verification under AML directives. | Integrate KYC verification provider (e.g. Sumsub, Persona, Veriff). |
| **Withdrawal Limits & Timelines** | Real-money withdrawals are disabled (`REAL_MONEY_WITHDRAWALS_ENABLED=false`). | Minimum withdrawal amount, daily/monthly cash-out limits, processing SLA, and payout fee structure. | Configure withdrawal thresholds in server environment config. |
| **Playthrough / AML Rules** | Deposits and withdrawals are disabled in the current build. | AML rules separating deposited funds from won competition prizes prior to withdrawal eligibility. | Implement counsel-approved AML checks in commercial withdrawal validation. |
| **Payment Processors** | No real payment provider adapter is active. | Selection and contract execution with merchant acquiring and payout partners. | Implement concrete `PaymentProvider` adapter and pass full reconciliation certification. |

---

## 4. Public Content Release Checklist (Internal)

Public pages intentionally use neutral publication-pending language where facts are not yet verified. Complete every item below before removing draft notices:

### Operator & Contact Information
- [ ] Confirm the operating legal **entity name** and entity type.
- [ ] Confirm the entity **registration or identification number**, if applicable.
- [ ] Confirm the jurisdiction of establishment and registered office/address.
- [ ] Supply verified public **support, legal/regulatory and privacy contact** channels.

### Terms, Privacy & Data Handling
- [ ] Approve final Terms & Privacy versions, governing law, dispute resolution, suspension/appeals, and effective dates; verify `CURRENT_POLICY_VERSIONS` matches.
- [ ] Verify active hosting/data-processing providers and set approved **retention periods** (do not invent fixed periods).
- [ ] Confirm user-rights request process and whether any non-essential analytics/cookies are enabled.

### Translations & External Filings
- [ ] Complete legal review of English Terms, Privacy Policy, Competition Rules, Fair Competition, and Sandbox Notice.
- [ ] Obtain qualified **Georgian and Russian** legal review of long-form translations before marking either language complete.
- [ ] Confirm whether a **Revenue Service filing** or classification process applies before making any filing claim; record bank-requested evidence only after verified requests.

---

## 5. Policy Versioning & Acceptance Tracking

- **Current Version Keys (`packages/shared/src/policies.ts`):** `TERMS`, `PRIVACY`, `COOKIES`, `RULES`, `WITHDRAWALS`, `REFUNDS`, `RESPONSIBLE_PLAY`, `ELIGIBILITY`, `FAIR_PLAY`, `DISPUTES`, `DATA_RIGHTS`, `SECURITY`, `ABOUT`, `CONTACT`, `SANDBOX_NOTICE`.
- **Durable Audit:** Registrations record `userId`, `policyType`, `policyVersion`, `source`, `ipAddress`, and `userAgent` in `policy_acceptances`.
