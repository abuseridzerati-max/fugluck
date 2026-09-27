# Bank integration intake — information to supply before implementation

Status: **PLANNED / awaiting bank and operator answers** (2026-09-27). This is a fill-in template, not an instruction to enable money. The accepted staging baseline and source-verified adapter map are in [Bank integration readiness](BANK_INTEGRATION_READINESS.md). Record an answer, document link and bank contact/date for each item. Write **N/A with the bank's reason** where a capability truly does not apply. Do not paste live API keys, private certificates, passwords, access tokens or customer data into this document or chat; identify the approved secret-delivery channel and key IDs instead.

## REQUIRED — needed to decide whether and how an adapter can be built

| Area | Bank/operator answer and authoritative source |
| --- | --- |
| Provider identity | Legal bank/provider name, contracted entity, product name, technical and support contacts, document/API version: **[answer]** |
| Documentation and access | API reference, webhook specification, status/error catalogue, sandbox portal, production onboarding guide and change-notification channel: **[links/answer]** |
| Environments | Sandbox and production base URLs, account/merchant IDs, region, separate credential scopes, whether test/production data or keys can cross: **[answer]** |
| Authentication | Authentication type for each endpoint; API key/client ID identifiers and scopes; OAuth grant/token URL/scopes/expiry/refresh if used; certificate/mTLS chain and rotation rules if used; source IP allowlisting and outbound/inbound network requirements: **[answer]** |
| Deposit initiation | API operation to create a payment/deposit; request/response examples with redacted identifiers; payer identification/consent; supported methods; redirect/hosted-page/SDK steps; which server-side value is authoritative: **[answer]** |
| Currency and limits | GEL support and minor-unit convention; other supported currencies; per-operation minimum/maximum, daily/monthly and account limits; FX/conversion ownership if any: **[answer]** |
| Deposit lifecycle | All payment states and terminality rules; status lookup API; expiry/cancellation; final confirmation and failure evidence; whether a success can later reverse: **[answer]** |
| Callback security | Delivery method/URL registration, event schema and event ID, raw-body signing/MAC or other authentication, timestamp/nonce tolerance, replay rules, certificate/key rotation, retry/backoff and ordering guarantees: **[answer]** |
| Payout initiation | Withdrawal/payout API, beneficiary identification and verification, allowed destination types, request/response and bank reference, beneficiary-change controls: **[answer]** |
| Payout lifecycle | States and terminality, status lookup, reject/failure/return semantics, cancellation window, whether an accepted payout can later fail or be recalled: **[answer]** |
| Refunds and reversals | Deposit refund API, partial/full refund rules, eligibility window, reversal/return events, reference linkage, fees and timing: **[answer]** |
| Disputes | Chargeback/dispute notification, evidence/response windows, liability and accounting treatment, representment API/process: **[answer]** |
| Identity and retry | Provider payment/payout/refund IDs and event IDs; merchant correlation fields; idempotency header/key retention and scope; behavior on timeout, duplicate call or uncertain outcome: **[answer]** |
| Error and capacity | Error code taxonomy (permanent/retryable/unknown), HTTP/network timeout guidance, rate limits, concurrency and backoff requirements: **[answer]** |
| Reconciliation | Transaction/balance/settlement API or files, completeness window, pagination, stable IDs, correction files, settlement cut-off/time zone and reporting retention: **[answer]** |
| Money movement | Settlement timing, bank/merchant account ownership, fees (including failed/refunded/disputed operations), payout funding and reserve/hold terms: **[answer]** |
| Bank compliance | Bank-imposed KYC/AML, age/residency, sanctions/PEP, transaction monitoring, record retention and reporting requirements; who performs each duty: **[answer]** |
| Go-live | Contract/onboarding prerequisites, required certification/test cases, production credential issuance, approval owner and rollback/support procedure: **[answer]** |

## OPTIONAL — provide if the bank offers or requires it

| Capability | Answer / N/A and source |
| --- | --- |
| Webhook event replay API, dead-letter retrieval, sequence numbers or cursor polling | **[answer]** |
| Sandbox fault injection for timeout, duplicate/out-of-order callback, reversal, partial refund and payout rejection | **[answer]** |
| Provider-side beneficiary validation, name match, account ownership, confirmation of payee | **[answer]** |
| Account/balance API, automated settlement report delivery (SFTP/object storage), dispute portal | **[answer]** |
| Operational SLA/availability history, incident status page, escalation hours and emergency contact | **[answer]** |
| Scheduled maintenance calendar, version deprecation notice and multi-region failover | **[answer]** |

## UNKNOWN / applicability decisions — resolve with the bank before design is frozen

- Is the bank a payment initiator, collector, custodian, payout provider, or a combination? Which legal entity is merchant of record and which holds customer funds? **[answer]**
- Is a browser redirect only a navigation signal, or can the bank provide an independently authenticated final server event/status? **[answer]**
- Can a `SUCCEEDED` payment later be reversed or charged back, and can a completed payout return? What is the bank's finality definition? **[answer]**
- Is provider idempotency strong across network timeouts and for how long? If not, what lookup-before-retry or manual resolution path is contractually supported? **[answer]**
- Are partial refunds, multi-currency settlement, provider fees/net settlement, delayed capture, and payout cancellation in scope for Fugluck's intended product? **[answer]**
- Does the bank require production callbacks from fixed IPs, mTLS, dedicated domains, or separate approved accounts per environment? **[answer]**
- What amount, frequency, jurisdiction, age, identity and AML thresholds are imposed by the bank versus set by the operator/counsel? **[answer]**
- Which bank-produced record is the reconciliation source of truth when callbacks, status polling and settlement files disagree? **[answer]**

## Submission format for tomorrow

Paste non-secret answers and documentation links here or in the conversation, plus the bank's sample **redacted** request/response and event payloads. Mark unanswered items `UNKNOWN` rather than guessing. Deliver actual credentials/certificates later through an approved secret store after the implementation and environment separation are reviewed. Also provide the separate major product/architecture restructure specification; it may change the adapter boundary or product eligibility before bank work starts.
