import { CURRENT_POLICY_VERSIONS, type PolicyType } from '@fugluck/shared'

export type PolicySection = {
  id: string
  heading: string
  content: string[]
  note?: string
}

export type PolicyDocument = {
  type?: PolicyType
  slug: string
  title: string
  subtitle: string
  version?: string
  status: 'INFORMATIONAL' | 'DRAFT_LEGAL_REVIEW' | 'DRAFT_IMPLEMENTATION_REVIEW' | 'PRODUCT_ALIGNED_DRAFT' | 'HISTORICAL'
  statusText: string
  summary: string
  sections: PolicySection[]
  relatedSlugs: string[]
}

const section = (id: string, heading: string, ...content: string[]): PolicySection => ({ id, heading, content })

export const POLICIES: Record<string, PolicyDocument> = {
  about: {
    slug: 'about', title: 'About Fugluck', subtitle: 'A competitive skill-gaming platform for direct play and platform-defined competitions.',
    status: 'INFORMATIONAL', statusText: 'Product information · English source',
    summary: 'Fugluck is a competitive skill-gaming platform built around short games in which players participate directly. The platform is designed to support practice, casual social play and structured competitions with rules that are published before a player enters.',
    sections: [
      section('who-defines-competition', 'Who defines the competition?', 'Fugluck defines each competition format. Before entry, the platform specifies the game, format, participant capacity, entry fee where applicable, predetermined prize schedule, rules version and other competition conditions. Players decide whether to enter those published conditions; they do not create or negotiate monetary competition terms with one another.'),
      section('what-determines-results', 'What determines the result?', "In competition-enabled games, the live game session is server-authoritative. A player's device sends control actions, while the server maintains the authoritative competitive state, applies the game's rules and determines the score and result. A competition result is not accepted merely because a browser reports a winning score."),
      section('building-toward', 'What Fugluck is building toward', 'Fugluck is being prepared as a broader skill-gaming and esports platform. The game catalog can expand over time, including additional Fugluck-developed games and, where appropriate, other games that meet the platform’s technical and competition requirements. A game is not automatically eligible for prize-bearing competition simply because it appears in the catalog.'),
      section('sandbox-status', 'Current sandbox status', 'The current Revenue Service review build is a sandbox demonstration. TEST / SANDBOX GEL is simulated only and has zero real-world value. The current build does not accept real-money deposits, process withdrawals or issue real-money prizes.'),
      section('operator-disclosure', 'Operator information', 'Where operator identity information is required, the verified legal entity name, registration details, address and support contact must be added only after the user or legal adviser provides authoritative values. See Contact / Who We Are for the outstanding fields.'),
    ], relatedSlugs: ['how-it-works', 'games-and-skill', 'competition-model', 'test-gel', 'contact'],
  },
  'how-it-works': {
    slug: 'how-it-works', title: 'How Fugluck Works', subtitle: 'Practice, casual play and structured competition follow different paths.',
    status: 'INFORMATIONAL', statusText: 'Product information · English source',
    summary: 'Fugluck separates casual play from structured competition. A player can practice a game, use free Coins in supported casual contexts, or enter an available competition whose terms are published by the platform.',
    sections: [
      { id: 'competition-journey', heading: 'A typical competition journey', content: [
        '1. Create or sign in to a Fugluck account.', '2. Browse available competitions and choose a game and format.', '3. Review the Entry Fee, Predetermined Prize, participant capacity and applicable rules.', '4. Confirm entry. If the competition has an Entry Fee, the sandbox accounting system reserves the required TEST GEL amount.', '5. When the competition fills and its start conditions are satisfied, the instance is locked and the required entries are captured according to the competition lifecycle.', '6. The server creates the live authority session and binds it to the competition, game, participant and rules version.', '7. Players compete by sending controls from their devices. The server maintains authoritative competitive state and score.', '8. The server determines the result according to the game and competition rules.', '9. The competition lifecycle applies the published result: settlement, refund or void as appropriate.', '10. The completed Competition Instance remains a historical record of the rules and result that applied at the time.',
      ] },
      section('practice-casual', 'Practice and casual play', 'Practice and casual modes may use different technical requirements from prize-bearing competition. A game can be available for practice or Coins play without being certified for TEST GEL competition. Fugluck visibly distinguishes these statuses so players do not assume every game supports the same competition formats.'),
      section('rematches', 'Rematches', 'A rematch is a new competition entry, not a continuation of the previous transaction. If a rematch format is offered, it creates a new Competition Instance with a new authority session and a new accounting lifecycle. A rematch does not carry forward the previous competition’s captured entry, prize or result.'),
    ], relatedSlugs: ['competitions', 'entry-fees-prizes', 'games-and-skill', 'coins', 'test-gel'],
  },
  'competition-model': {
    slug: 'competition-model', title: 'Competitions', subtitle: 'Platform-defined contests with published terms and an immutable record for each occurrence.',
    status: 'INFORMATIONAL', statusText: 'Product information · English source',
    summary: 'A Fugluck competition is a platform-defined contest with terms published before entry. The platform creates and maintains the competition format; participants choose whether to enter it.',
    sections: [
      section('published-terms', 'Terms defined in advance', 'Each published format identifies its game; competition format; participant capacity; Entry Fee, including FREE where applicable; Predetermined Prize schedule; rules version; skill-assessment or game-configuration version where applicable; jurisdiction or product-market configuration where applicable; and start and terminal conditions.'),
      { id: 'player-boundaries', heading: 'What players cannot do', content: ['Fugluck’s current target model does not allow players to:', '• create arbitrary monetary competition terms;', '• choose or negotiate the amount another participant must risk;', '• increase the Entry Fee after publication;', '• negotiate the Predetermined Prize;', '• create a player-owned monetary pot;', '• challenge a friend for money under privately chosen terms;', '• place a wager on another player’s result; or', '• place a wager on an external sport, match, event or occurrence.'] },
      section('templates-instances', 'Competition Templates and Instances', 'A Competition Template is the published blueprint for a format. A Competition Instance is one specific occurrence entered by participants. When an instance is created, the relevant competition terms are snapshotted so later template changes do not rewrite the terms of an existing historical competition.'),
      section('match-versus-competition', 'Match versus competition', 'The competition is the full rules and accounting container. The match is the live gameplay session inside that competition. A 1v1 duel is therefore a competition format containing a head-to-head match. “Tournament” is reserved for formats that genuinely involve tournament-style structures such as multiple rounds, brackets or larger placement schedules.'),
      section('eligible-games', 'Current eligible games', 'For the current Revenue Service review build, Space Blaster and Cyber Hopper are the two Level 3 server-authoritative demonstration games. Other catalog games may remain available for practice or casual play without being eligible for TEST GEL competition.'),
    ], relatedSlugs: ['competitions', 'entry-fees-prizes', 'rules', 'games-and-skill'],
  },
  'entry-fees-prizes': {
    slug: 'entry-fees-prizes', title: 'Entry Fees and Predetermined Prizes', subtitle: 'Two separate terms, published before a participant enters.',
    status: 'INFORMATIONAL', statusText: 'Product information · English source',
    summary: 'Fugluck treats the Entry Fee and the Predetermined Prize as separate properties of a competition. The prize schedule is published before participants enter and is not required to equal the amount collected from participants minus a platform percentage.',
    sections: [
      { id: 'standard', heading: 'Standard competition example', content: ['Participants: 2', 'Entry Fee: TEST ₾5 each', 'Aggregate entries: TEST ₾10', 'Predetermined Prize: TEST ₾9', 'In this example, the competition publishes a TEST ₾5 Entry Fee and a TEST ₾9 Predetermined Prize. These values are configured as separate competition terms.'] },
      { id: 'promotional', heading: 'Promotional competition example', content: ['Participants: 2', 'Entry Fee: TEST ₾5 each', 'Aggregate entries: TEST ₾10', 'Predetermined Prize: TEST ₾20', 'A promotional competition demonstrates that the prize is not constrained to participant entries. The platform or a promotional funding source can support a predetermined prize that exceeds aggregate entries.'] },
      { id: 'freeroll', heading: 'Freeroll example', content: ['Participants: Defined by format', 'Entry Fee: FREE', 'Aggregate entries: TEST ₾0', 'Predetermined Prize: TEST ₾10', 'A freeroll has no Entry Fee. The Predetermined Prize exists independently of participant entry payments.'] },
      { id: 'wording', heading: 'How the terms are described', content: ['Entry Fee and Predetermined Prize are separate labels. Freeroll entry is shown as FREE, not TEST ₾0. Aggregate entries are not described as a pot; the prize is not described as “winner takes the stakes”; “rake” is not current player-facing terminology; and the interface does not imply that one participant directly transfers their entry to the winner.', 'All values shown on the current staging review build are TEST / SANDBOX GEL only and have zero real-world value.'], note: 'TEST / SANDBOX GEL · NO REAL MONEY'},
    ], relatedSlugs: ['competitions', 'test-gel', 'sandbox-notice', 'rules'],
  },
  'games-and-skill': {
    slug: 'games-and-skill', title: 'Games and Skill', subtitle: 'Practice availability does not automatically mean competition certification.',
    status: 'INFORMATIONAL', statusText: 'Product information · English source',
    summary: 'Fugluck can offer games in different modes. Practice or casual availability does not automatically make a game eligible for prize-bearing competition. For the Revenue Service review build, Space Blaster and Cyber Hopper are the two Level 3 server-authoritative demonstration games.',
    sections: [
      section('space-blaster', 'Space Blaster', 'Space Blaster is a real-time action game in which the player moves a ship, fires at hazards or targets, avoids collisions and attempts to produce a better server-authoritative score than the opponent under the same competition format. Player timing, movement, firing decisions, positioning and survival affect performance.', 'During competition play, the server owns authoritative movement state, bullets, hazards, collisions, survival state and score. The player’s browser renders the game and sends control intent; it does not have authority to choose the final score or winner.'),
      section('cyber-hopper', 'Cyber Hopper', 'Cyber Hopper is a directional movement game in which the player advances through a grid while avoiding moving hazards. Player decisions about direction, timing, progress and hazard avoidance affect the result.', 'During competition play, the server owns authoritative grid position, moving hazards, collisions, progress and score. The player’s device sends directional hop controls and renders authoritative state received from the server.'),
      section('generation', 'Deterministic generation and seeded variation', 'Some Fugluck game engines may use deterministic, server-controlled seeded generation for items such as obstacle or hazard patterns. The technical purpose is to create reproducible, controlled game state rather than to let the client choose competitive conditions. Public materials should describe exactly what the server generates and how the same competition rules apply; Fugluck does not make a blanket claim that it contains no randomness.'),
      section('other-games', 'Other catalog games', 'Other games may remain available for practice or casual play while not being certified for the current TEST GEL competition scope. The website must not imply Level 3 competition eligibility for a game that has not completed the relevant authority and acceptance process.'),
      section('certification-table', 'Current competition scope', 'Level 3 certified for the current TEST GEL review scope: Space Blaster (`space-blaster-rv001-v1`) and Cyber Hopper (`cyber-hopper-rv001-v1`). Neon Runner and Pixel Ninja Dash are not certified for TEST GEL competition. Speed Trivia Clash and True / False Sprint are outside the current prize-bearing scope.'),
    ], relatedSlugs: ['fair-play', 'competition-model', 'rules'],
  },
  coins: {
    slug: 'coins', title: 'Coins', subtitle: 'Free virtual points for supported casual and social activity.',
    status: 'INFORMATIONAL', statusText: 'Product information · English source',
    summary: 'Coins are Fugluck’s free virtual points for supported casual, social or practice-adjacent activity. Coins are not money and are not intended to represent a claim against Fugluck.',
    sections: [
      section('coins-use', 'How Coins are used', 'Coins may be allocated or refreshed according to the current product rules. Any allocation is a free virtual-point feature, not a monetary payment. Availability depends on the supported casual game mode.'),
      { id: 'coins-no-value', heading: 'What Coins are not', content: ['Coins are not withdrawable.', 'Coins are not redeemable for cash or GEL.', 'Coins are not convertible into TEST GEL or real GEL.', 'TEST GEL or real GEL cannot be converted into Coins.', 'Coins are not cryptocurrency.'] },
    ], relatedSlugs: ['how-it-works', 'test-gel', 'wallet'],
  },
  'test-gel': {
    slug: 'test-gel', title: 'TEST / Sandbox GEL', subtitle: 'Simulated values used only in the staging and review demonstration.',
    status: 'INFORMATIONAL', statusText: 'Product information · English source',
    summary: 'TEST / SANDBOX GEL — NO REAL MONEY. All GEL-denominated competition values in the current staging / Revenue Service review build are simulated. They demonstrate competition and accounting behavior before any separate real-payment activation.',
    sections: [
      { id: 'test-value', heading: 'What TEST GEL means', content: ['TEST / SANDBOX GEL has zero real-world monetary value.', 'It cannot be purchased with real money.', 'It cannot be withdrawn.', 'It cannot be redeemed for actual GEL.', 'It cannot be transferred to a bank account.', 'It is not actual GEL held on a user’s behalf.', 'It does not represent an active deposit or payment service.', 'It is used only to test and demonstrate the intended competition and accounting architecture.'] },
      section('admin-test-funds', 'Test funds for demonstrations', 'Administrative or QA tools may add TEST funds for demonstration purposes. Those actions are labeled Add Test Funds or Grant Test Funds, never Deposit.'),
      section('future-activation', 'Future service changes', 'A future commercial real-money service would require separate activation, financial infrastructure and any legal or regulatory approvals or conditions applicable at that time. Nothing on this page claims that approval has been obtained.'),
    ], relatedSlugs: ['sandbox-notice', 'entry-fees-prizes', 'coins', 'wallet'],
  },
  'sandbox-notice': {
    type: 'SANDBOX_NOTICE', slug: 'sandbox-notice', title: 'Sandbox / Test Money Notice', subtitle: 'Status of all GEL-denominated values in the current review environment.',
    version: CURRENT_POLICY_VERSIONS.SANDBOX_NOTICE, status: 'PRODUCT_ALIGNED_DRAFT', statusText: 'Product-aligned draft · no real-money service',
    summary: 'The current Fugluck Revenue Service review environment is a sandbox demonstration. Any GEL-denominated balance, Entry Fee, prize, funding grant, ledger posting, settlement or refund shown in this environment is TEST / SANDBOX GEL only.',
    sections: [
      section('sandbox-value', 'TEST GEL has no real-world value', 'TEST GEL is not real Georgian lari.', 'TEST GEL cannot be purchased, withdrawn or redeemed.', 'No bank account is credited or debited when TEST GEL moves.', 'No card or payment service provider is used to fund TEST GEL.', 'TEST prizes are simulation outputs used to demonstrate how the future competition lifecycle and accounting architecture are intended to behave.'),
      section('sandbox-not-payment', 'No active payment service', 'The current review build does not provide real-money deposits, withdrawals, bank processing, card processing, payment rails or real prize payouts. TEST / SANDBOX GEL is not money held on a user’s behalf and does not represent a deposit.'),
      section('commercial-future', 'A future commercial service', 'A future commercial real-money service would require separate activation, financial infrastructure and any legal or regulatory approvals or conditions applicable at that time. This notice does not claim that any such approval, licence, classification or decision exists.'),
    ], relatedSlugs: ['terms', 'privacy', 'rules', 'legal'],
  },
  terms: {
    type: 'TERMS', slug: 'terms', title: 'Terms of Service', subtitle: 'Draft terms for the current Fugluck account, game and sandbox competition features.',
    version: CURRENT_POLICY_VERSIONS.TERMS, status: 'DRAFT_LEGAL_REVIEW', statusText: 'DRAFT · LEGAL REVIEW REQUIRED · NOT FINAL OR EFFECTIVE',
    summary: 'This draft aligns service language with the current sandbox architecture. It is not a legal opinion. Operator identity, governing law, dispute language, age and eligibility requirements, and policy dates require human/legal approval before this document can be final.',
    sections: [
      section('scope-acceptance', '1. Scope and acceptance', 'These Terms govern access to and use of Fugluck’s website, account features, games, practice modes, casual features and sandbox competition features. By creating an account or using the service, a user agrees to the version of the Terms presented through the product, subject to any eligibility requirements and local-law restrictions that are finalized by the operator.'),
      section('sandbox-status', '2. Current sandbox status', 'The current Revenue Service review build does not provide real-money deposits, real-money withdrawals or real-money prize payouts. All GEL-denominated values shown in the staging environment are TEST / SANDBOX GEL with zero real-world monetary value.'),
      section('accounts', '3. Accounts and account security', 'Users must provide accurate information required by the product, protect their credentials and use only accounts they are authorized to control. Users must not share passwords, session tokens or other credentials. The operator may apply security measures, account restrictions or verification steps appropriate to the service.'),
      section('platform-defined', '4. Platform-defined competitions', 'Fugluck publishes competition formats and terms before entry. The platform defines the game, participant capacity, Entry Fee where applicable, Predetermined Prize schedule, rules version and applicable start or terminal conditions. Users choose whether to enter the published format but may not privately rewrite those terms.'),
      section('entry', '5. Competition entry', 'Entering a competition is a request to participate under the published terms. For TEST GEL formats, the sandbox accounting system may reserve the required Entry Fee while the competition waits for its start conditions. An entry does not guarantee that a competition will start if capacity, technical, integrity or eligibility conditions are not satisfied.'),
      section('fees-prizes', '6. Entry Fees and Predetermined Prizes', 'The Entry Fee and Predetermined Prize are separate competition terms. The prize is published before entry and is not required to equal aggregate participant entries minus a platform percentage. Promotional competitions and freerolls may use other approved funding sources in the sandbox accounting model.'),
      section('instances', '7. Competition Instances', 'Each Competition Instance is a specific occurrence of a published format. Relevant competition terms are snapshotted for that instance so later changes to the template do not rewrite the historical terms of an existing instance.'),
      section('skill-authority', '8. Skill-based gameplay and server authority', 'In certified competition games, the server maintains authoritative competitive game state and score. The client sends permitted control intent and renders authoritative updates. Users may not manipulate, bypass or interfere with this process.'),
      section('ties', '9. Ties', 'For current head-to-head sandbox competitions, an exact authoritative tie is handled under the applicable competition rules, presently by void and refund rather than random selection. Any future tiebreak mechanism must be explicitly defined by the relevant competition rules.'),
      section('forfeits', '10. Forfeits', 'A player-caused forfeit may produce a legitimate opponent victory where the competition rules permit. The platform distinguishes a player forfeit from a system or infrastructure failure.'),
      section('disconnects', '11. Disconnects and reconnects', 'A temporary connection loss may be subject to a defined reconnect window. The platform may replace an old controlling connection with a valid new connection. If a valid result cannot safely be established, the competition may be voided according to the applicable rules.'),
      section('cancellations-voids-refunds', '12. Cancellations, voids and refunds', 'Pending competitions may be cancelled where the lifecycle permits. A competition may be voided when the platform cannot safely establish or apply a valid result. Sandbox reservations may be released before capture, and captured TEST entries may be refunded when the rules require it.'),
      section('rematches', '13. Rematches', 'A rematch is a new Competition Instance with a new participation decision, new authority session and new accounting lifecycle. It does not carry forward the previous competition’s entry or settlement.'),
      section('coins', '14. Coins', 'Coins are free non-monetary virtual points. They are not redeemable, withdrawable or convertible into GEL, and do not represent money held for the user.'),
      section('test-gel', '15. TEST / Sandbox GEL', 'TEST GEL is simulated value with zero real-world monetary value. It cannot be deposited as real money, withdrawn, redeemed, transferred to a bank account or treated as a claim for actual GEL.'),
      section('retired-diamonds', '16. Retired Diamonds', 'Diamonds are retired from active product use. Historical Diamond records may remain in account or audit history as legacy information, but active Diamond purchasing, staking or competition entry is not part of the current target service.'),
      section('prohibited-conduct', '17. Prohibited conduct', 'Users must not cheat, automate play through unauthorized bots, tamper with the client or network protocol, attempt to submit fabricated results, interfere with another participant, abuse reconnect or session mechanisms, exploit vulnerabilities, evade account restrictions, access another person’s account, attack service infrastructure or otherwise undermine fair competition.'),
      section('multiple-accounts', '18. Multiple accounts and collusion', 'Final multi-account and collusion rules require operator approval. At minimum, users may not use multiple accounts, coordinated behavior or account sharing to manipulate competition outcomes or evade restrictions.'),
      section('availability', '19. Service availability and technical limitations', 'Online services can experience latency, outages, device incompatibility, software defects or third-party infrastructure issues. Fugluck may delay, reject, cancel or void a competition when required to protect integrity. No technical system can guarantee uninterrupted availability.'),
      section('suspension', '20. Suspension and termination', 'The operator may restrict or terminate access for security, abuse, Terms violations, legal requirements or operational reasons, subject to the final account policy and applicable law.'),
      section('intellectual-property', '21. Intellectual property', 'Fugluck software, branding, game assets and platform content are protected by the rights held by the operator or applicable licensors. Users receive only the limited permission needed to use the service under these Terms.'),
      section('user-content', '22. User content and communications', 'If the service permits profile content, messages, reports or other user submissions, users must not submit unlawful, abusive, infringing or malicious material. Exact moderation and content-licence language should be finalized based on the actual social features enabled at launch.'),
      section('privacy', '23. Privacy', 'Use of personal information is described in the Privacy Policy. These Terms should link to the current policy version.'),
      section('changes', '24. Changes to the service and Terms', 'The operator may update the service and these Terms. Material changes should use the product’s existing versioning and acceptance mechanism where required.'),
      section('governing-law', '25. Governing law and disputes', 'Governing law, jurisdiction and dispute-resolution terms have not been finalized for this review build. Approved terms will be published after the operating entity and applicable legal requirements are confirmed.'),
      section('terms-contact', '26. Contact', 'Verified operator identity and support/legal contact details will be published before commercial launch. See Contact / Who We Are for the current publication status.'),
    ], relatedSlugs: ['privacy', 'rules', 'fair-play', 'sandbox-notice', 'contact'],
  },
  privacy: {
    type: 'PRIVACY', slug: 'privacy', title: 'Privacy Policy', subtitle: 'Product-aligned draft framework for account, competition and technical information.',
    version: CURRENT_POLICY_VERSIONS.PRIVACY, status: 'DRAFT_IMPLEMENTATION_REVIEW', statusText: 'DRAFT · IMPLEMENTATION AND LEGAL REVIEW REQUIRED · RETENTION AND CONTACT INPUTS PENDING',
    summary: 'This draft must be validated against the actual code, hosting providers, analytics configuration, support workflow and operator decisions before publication as a final legal policy. It intentionally does not invent retention periods, processor lists, cross-border statements or compliance claims.',
    sections: [
      section('provided-information', '1. Information a user provides', 'Depending on the enabled product features, Fugluck may process account identifiers such as username, email address if collected, authentication credentials in protected form, profile information, support requests and other information a user submits directly.'),
      section('competition-information', '2. Competition and gameplay information', 'Fugluck maintains records needed to operate competitions, including competition entries, instance identifiers, game and rules versions, authority-session state, results, terminal decisions, sandbox accounting references and related audit information. Exact telemetry should be described based on the implementation actually enabled.'),
      section('technical-information', '3. Security and technical information', 'The service may process technical information needed for authentication, abuse prevention, rate limiting, session security, troubleshooting and operational health, such as IP-related request data, device/browser information, timestamps, request logs, error logs, latency or connection measurements, where the deployed system actually records them.'),
      section('cookies-sessions', '4. Cookies and sessions', 'Fugluck uses cookies or equivalent browser storage for authentication/session functionality and may use additional storage only where the product actually requires it. The final policy should identify non-essential analytics or tracking cookies only if they are truly enabled.'),
      section('admin-audit', '5. Admin and audit records', 'Administrative actions can be recorded in immutable audit logs to support security, accountability and operational review.'),
      section('uses', '6. How information is used', 'Information may be used to provide accounts and games, operate competitions, maintain authoritative sessions, process sandbox accounting, prevent abuse, investigate errors, provide support, maintain security and comply with applicable legal obligations once those obligations are confirmed.'),
      section('providers', '7. Service providers', 'The current implementation uses external hosting/infrastructure providers. The final Privacy Policy should identify processors and service providers only after the deployed provider list is verified and approved.'),
      section('retention', '8. Retention', 'Retention periods or criteria for account, competition, authority, audit, support and security records have not been finalized. This draft does not state a fixed retention period; the approved approach will be published after review.'),
      section('sharing', '9. Sharing and disclosure', 'Fugluck should not disclose user information beyond what is necessary for service providers, legal obligations, security, corporate transactions or user-authorized purposes. Final disclosure language requires legal review against the actual operator structure and applicable law.'),
      section('rights-contact', '10. User rights and contact', 'The rights request process and privacy contact channel have not been finalized for this review build. Applicable user-rights information and verified contact details will be published after review for the operating entity and jurisdictions served.'),
      section('security', '11. Security', 'Fugluck applies technical and organizational safeguards appropriate to the service, but no system can guarantee absolute security. Users should protect account credentials and report suspected compromise promptly.'),
      section('policy-changes', '12. Changes', 'Material policy changes should be versioned through the existing policy/version mechanism where applicable. Version identifiers and effective dates must be consistent across translations of the same approved policy version.'),
    ], relatedSlugs: ['terms', 'sandbox-notice', 'contact', 'legal'],
  },
  rules: {
    type: 'RULES', slug: 'rules', title: 'General Competition Rules', subtitle: 'Common rules for platform-defined competitions in the current sandbox.',
    version: CURRENT_POLICY_VERSIONS.RULES, status: 'PRODUCT_ALIGNED_DRAFT', statusText: 'PRODUCT-ALIGNED DRAFT · REVIEW BEFORE COMMERCIAL USE',
    summary: 'These rules describe the current platform-defined TEST GEL competition flow. Competition-specific terms and game rules are published with each eligible competition.',
    sections: [
      section('published-competition-terms', '1. Published competition terms', 'Every competition must identify its game, format, participant capacity, Entry Fee, Predetermined Prize schedule and applicable rules/version information before entry.'),
      section('eligibility', '2. Eligibility', 'A participant must satisfy the account and game-eligibility requirements for the competition. Prize-bearing sandbox formats require an eligible signed-in account. A game must also be certified for the applicable competition mode.'),
      section('registration-reservation', '3. Registration and reservation', 'When a participant registers for a TEST GEL competition, the sandbox accounting system can reserve the Entry Fee. Reserved funds are not yet a final settlement.'),
      section('lock-capture', '4. Lock and capture', 'When required participants and start conditions are satisfied, the instance can lock. The lifecycle captures eligible TEST entries according to the active competition rules.'),
      section('authority-session', '5. Authority session', 'For Level 3 games, the server creates and controls the authority session. The session is bound to the competition, game/version and participant/controller identity.'),
      section('permitted-controls', '6. Permitted controls', 'Players may use only the normal controls exposed by the game. Attempts to inject unsupported, duplicate, stale or unauthorized controls can be rejected.'),
      section('authoritative-result', '7. Authoritative result', 'The server’s competition authority determines competitive state, score and terminal result. A client-displayed value does not override the server’s authoritative result.'),
      section('ties', '8. Ties', 'Current head-to-head sandbox ties are handled by void and full refund unless the published rules for a future format define a deterministic skill-based tiebreak.'),
      section('forfeits', '9. Forfeits', 'A player forfeit may result in an opponent victory where the competition rules establish that outcome.'),
      section('disconnects', '10. Disconnects', 'Temporary disconnects may be subject to a reconnect window. Controller ownership is managed by the server. An obsolete connection cannot retain authority after replacement.'),
      section('technical-failure', '11. System or network failure', 'When infrastructure uncertainty prevents a safe authoritative result, the competition should not invent a winner. The lifecycle can void the competition and apply the required release/refund.'),
      section('cancellation', '12. Cancellation', 'A pending competition can be cancelled before the applicable irreversible lifecycle point. Reserved TEST funds are released according to the accounting rules.'),
      section('void', '13. Void', 'A void is a terminal outcome used when competition rules or integrity conditions require that no competitive winner be applied.'),
      section('refund', '14. Refund', 'A refund is recorded through the sandbox accounting ledger. Existing ledger history is not rewritten to simulate the refund.'),
      section('settlement', '15. Settlement', 'Settlement applies the authoritative result and published prize schedule exactly once. Duplicate or repeated settlement attempts must not create duplicate sandbox credits.'),
      section('rematch', '16. Rematch', 'A rematch, where offered, is a new competition. It requires new entry eligibility and a new Competition Instance.'),
      section('game-specific', '17. Game-specific rules', 'Each competition game can supplement these General Competition Rules with its own controls, scoring, terminal conditions and game-specific integrity requirements.'),
    ], relatedSlugs: ['competition-model', 'entry-fees-prizes', 'fair-play', 'sandbox-notice'],
  },
  'fair-play': {
    type: 'FAIR_PLAY', slug: 'fair-play', title: 'Fair Competition and Server Authority', subtitle: 'How live authority works and what the safeguards do—and do not—guarantee.',
    version: CURRENT_POLICY_VERSIONS.FAIR_PLAY, status: 'PRODUCT_ALIGNED_DRAFT', statusText: 'PRODUCT-ALIGNED DRAFT · REVIEW ENFORCEMENT AND APPEALS BEFORE COMMERCIAL USE',
    summary: 'Fugluck’s competition architecture is designed so competitive results are determined by server-authoritative game state rather than by trusting a score reported by the player’s browser.',
    sections: [
      section('player-device', 'What the player’s device does', 'Displays the game and interface.', 'Collects permitted control actions from the player.', 'Sends those controls to the competition authority session.', 'Receives authoritative game-state updates for presentation.'),
      section('server', 'What the server does', 'Creates and binds the authority session to the competition and participant.', 'Maintains the authoritative competitive state.', 'Applies the game’s movement, collision, progress and scoring rules.', 'Rejects invalid, stale, duplicate or unauthorized control/session activity as defined by the authority protocol.', 'Determines the authoritative terminal result.', 'Hands the result to the competition lifecycle and sandbox accounting system.'),
      section('game-authority', 'Space Blaster and Cyber Hopper', 'In Space Blaster competition play, the server owns ship movement, bullets, hazards, collisions, survival state and score. In Cyber Hopper competition play, the server owns grid movement, moving hazards, collisions, progress and score. Both games currently use versioned Level 3 server-authoritative competition flows.'),
      section('reconnect-uncertainty', 'Reconnects and technical uncertainty', 'The platform controls reconnect ownership so an old connection cannot continue controlling a player after a replacement controller has been accepted. Where the server cannot establish a valid competitive result because of a system or network failure, the product rules should prefer a safe void/refund outcome rather than inventing a winner.'),
      section('fair-play-rules', 'Fair Competition Policy', 'Fugluck is intended to reward direct player performance under published competition rules. Users are expected to participate personally and must not interfere with the integrity of the platform or another participant.', 'Do not use unauthorized bots, scripts, macros or automation to play competitions.', 'Do not tamper with the browser, client, network protocol, authority session or game state.', 'Do not attempt to fabricate scores, results, session identity or settlement events.', 'Do not share accounts or use another person’s account to gain an unfair advantage.', 'Do not coordinate with another participant to predetermine or manipulate a result.', 'Do not exploit a known defect or vulnerability instead of reporting it.', 'Do not intentionally disrupt another participant’s connectivity or access.', 'Do not abuse reconnect, multiple-account or matchmaking behavior to manipulate competition outcomes.'),
      section('review-and-enforcement', 'Reports and enforcement', 'Suspected cheating or integrity issues may be reviewed using competition, authority, audit and security records. Enforcement language, appeal process and account sanctions should be finalized by the operator before commercial launch.'),
      section('limits', 'What server authority does not guarantee', 'Server authority is an integrity control, not a claim that abuse is impossible. Bots, collusion, account sharing, network advantages and other forms of misconduct can require additional detection, enforcement and operational controls. Fugluck describes its protections accurately and does not claim that cheating is impossible.'),
    ], relatedSlugs: ['rules', 'games-and-skill', 'terms', 'contact'],
  },
  diamonds: {
    type: 'DIAMONDS', slug: 'diamonds', title: 'Historical Diamond Records', subtitle: 'Legacy information retained to interpret historical account and audit records.',
    version: CURRENT_POLICY_VERSIONS.DIAMONDS, status: 'HISTORICAL', statusText: 'DIAMONDS — RETIRED / LEGACY',
    summary: 'Diamonds are not part of Fugluck’s current active product model. Historical records created under earlier development architecture may remain available for auditability and historical accuracy.',
    sections: [
      section('historical-records', 'Historical records', 'Historical Diamond balances, ledger entries, match history, settlements and audit records may remain available for account history, audit and historical accuracy. Those records are not deleted or rewritten merely to simplify the current interface.'),
      section('retired-activity', 'Retired activity', 'There are no new Diamond purchases, Diamond competition entry, staking, active Diamond packs, active Diamond grants or active Diamond shop. DIAMONDS — RETIRED / LEGACY is a historical label, not an offer or current balance feature.'),
      section('current-sandbox', 'Current sandbox competitions', 'Current TEST GEL competitions are separate simulated accounting records. TEST GEL is not a replacement payment balance and has zero real-world value.'),
    ], relatedSlugs: ['wallet', 'test-gel', 'legal'],
  },
  contact: {
    type: 'CONTACT', slug: 'contact', title: 'Contact / Who We Are', subtitle: 'Operator identity and support channels are pending verified operator information.',
    version: CURRENT_POLICY_VERSIONS.CONTACT, status: 'DRAFT_IMPLEMENTATION_REVIEW', statusText: 'INFORMATION PENDING FINAL OPERATOR / LEGAL CONFIRMATION',
    summary: 'Verified operator identity and contact channels have not been provided for this review build. Operator and contact details will be published before commercial launch. Do not send passwords, session cookies or payment credentials in support messages.',
    sections: [
      section('operator-details', 'Operator information', 'Verified operator identity and registration information will be published before commercial launch.'),
      section('support-details', 'Support and legal contacts', 'Verified support, legal and privacy contact details will be published before commercial launch. No contact channels are provided on this review build.'),
      section('support-safety', 'When contacting support', 'For a technical report, include the approximate time, game, device/browser and a description of what happened. Do not send passwords, session cookies, access tokens or other credentials. The formal support and complaint-handling process remains subject to operator approval.'),
    ], relatedSlugs: ['help', 'privacy', 'fair-play', 'legal'],
  },
  legal: {
    slug: 'legal', title: 'Legal and Policy Index', subtitle: 'Current documents and their review status.',
    status: 'DRAFT_IMPLEMENTATION_REVIEW', statusText: 'REVIEW REGISTER · NO REGULATORY APPROVAL CLAIMED',
    summary: 'These documents describe the current product and review draft. No document on this index is evidence of a licence, legal classification or Revenue Service decision. Effective dates are not assigned until the operator approves them.',
    sections: [
      section('legal-documents', 'Documents', 'Terms of Service — Draft; legal review required.', 'Privacy Policy — Draft; implementation and legal review required.', 'General Competition Rules — Product-aligned draft.', 'Sandbox / Test Money Notice — Product-aligned draft.', 'Fair Competition and Server Authority — Product-aligned draft; enforcement and appeals require operator review.', 'Contact / Operator Information — Blocked on verified operator data.', 'Historical Diamond Records — Retired/legacy informational record.'),
      section('policy-status', 'Version and effective-date status', 'Policy pages display draft version identifiers where the existing version system requires them. The current drafts do not claim an approved effective date. Final Terms and Privacy versions and dates must be supplied or approved by the operator/legal adviser. Translations of the same approved policy must use matching identifiers and effective dates.'),
      section('pending-review', 'Information pending review', 'Terms and Privacy remain drafts and are not final or effective. Verified operator/contact information, applicable eligibility and territory rules, policy dates, data-handling disclosures, rights/contact procedures, dispute terms, and reviewed translations remain pending human or legal review. No legal classification, licence, regulator approval or Revenue Service decision is claimed.'),
      section('legal-status', 'Legal status', 'This site content is a product-information and review draft, not a legal opinion. It does not claim Revenue Service approval, gambling classification, licence, legal status or regulatory clearance.'),
    ], relatedSlugs: ['terms', 'privacy', 'rules', 'sandbox-notice', 'fair-play', 'contact'],
  },
}
