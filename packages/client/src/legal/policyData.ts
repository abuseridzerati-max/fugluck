import { CURRENT_POLICY_VERSIONS, type PolicyType } from '@fugluck/shared'

export type PolicySection = {
  id: string
  heading: string
  content: string[]
  note?: string
}

export type PolicyDocument = {
  type: PolicyType
  slug: string
  title: string
  subtitle: string
  lastUpdated: string
  version: string
  summary: string
  sections: PolicySection[]
  relatedSlugs: string[]
}

export const POLICIES: Record<string, PolicyDocument> = {
  terms: {
    type: 'TERMS',
    slug: 'terms',
    title: 'Terms of Service',
    subtitle: 'How the current Fugluck arcade and simulated competition features work.',
    lastUpdated: 'September 25, 2026',
    version: CURRENT_POLICY_VERSIONS.TERMS,
    summary:
      'These service terms describe the current platform features and account rules. They do not state a legal or regulatory classification for the service.',
    sections: [
      {
        id: 'acceptance',
        heading: '1. Acceptance of Terms & Account Registration',
        content: [
          'By accessing, registering for, or playing on Fugluck, you affirm that you have read, understood, and agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, you must not access or use the platform.',
          'An account is required for account features, social features, and entry into a TEST / SANDBOX GEL competition. Practice play does not require an opponent or competition entry.',
          'You are solely responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify Fugluck immediately of any unauthorized access or security breach.',
          'Each individual is permitted to operate only one active player account. Creating multiple accounts or operating puppet accounts for the purpose of rating manipulation, matchmaking evasion, or bonus exploitation is strictly prohibited.',
        ],
      },
      {
        id: 'modes-and-gameplay',
        heading: '2. Platform Access & Game Modes',
        content: [
          'Fugluck provides arcade games in Practice and casual play, plus a limited set of platform-defined TEST / SANDBOX GEL competitions.',
          'Practice play runs locally and does not create an entry or prize. Casual COINS are non-monetary play points; casual results are not used to award TEST GEL prizes.',
          'TEST / SANDBOX GEL competitions use a fixed entry fee and a predetermined prize configured by the platform. Players do not set monetary stakes or bet on external events. Space Blaster and Cyber Hopper are the only games currently certified for this live competition flow; templates may be disabled or unavailable.',
        ],
      },
      {
        id: 'server-authority',
        heading: '3. Competition Operation and Results',
        content: [
          'For an enabled certified TEST GEL competition, the server binds each participant to the competition instance and authority session. The server runs the score-bearing game state and decides the terminal result. The browser sends controls and displays server snapshots.',
          'Casual COINS match results are client-reported and are not authority-verified or eligible for TEST GEL prizes. Do not treat casual results as evidence of server-verified competition outcomes.',
          'The active TEST GEL flow supports two-player head-to-head competitions with a single predetermined first-place prize. Other formats are not available in the live authority flow.',
        ],
      },
      {
        id: 'outcomes-and-interruptions',
        heading: '4. Competition Outcomes and Interruptions',
        content: [
          'A certified TEST GEL competition result is determined from server-owned game state and the published competition rules. A tied or interrupted competition is voided/refunded according to its lifecycle outcome; an opponent is not assigned a winner when the system cannot establish a valid result.',
          'When a participant connection drops, the active authority may allow a reconnect window. Expired reconnects, loss of authority, or server-side failures follow the competition terminal and accounting safeguards. The applicable instance record is the source for its final status.',
        ],
      },
      {
        id: 'currencies-and-wallet',
        heading: '5. Simulated Funds and Retired Features',
        content: [
          'TEST / SANDBOX GEL is simulated development currency. It has no real-world value and cannot be deposited, withdrawn, redeemed, transferred to a payment service, or exchanged for money. Competition entry and prizes are simulated ledger entries only.',
          'COINS are non-monetary casual play points. DIAMONDS are retired from new play and funding. Historical Diamond balances and records are retained for account history and audit purposes.',
          'No payment processor, card processing, bank integration, real GEL deposit, withdrawal service, or real-value prize is active in the current product.',
        ],
      },
      {
        id: 'prohibited-conduct',
        heading: '6. Prohibited Conduct & Anti-Cheating',
        content: [
          'You agree not to engage in any prohibited activity, including but not limited to: running bots or automated input scripts; modifying client source code; memory injection; exploiting network latency or bugs; colluding with opponents; intentionally throwing matches; or attempting to manipulate the wallet ledger.',
          'Violations may result in restriction, suspension, or closure under the applicable account and competition procedures. TEST GEL outcomes remain subject to the system decision and accounting records; staff must not manually rewrite scores, winners, or settled ledger entries.',
        ],
      },
      {
        id: 'intellectual-property',
        heading: '7. Intellectual Property',
        content: [
          'All game code, graphic assets, animations, audio, logos, trademarks, and user interfaces on Fugluck are the proprietary intellectual property of Fugluck or its licensors. You are granted a limited, personal, revocable license to access and play the games for individual entertainment.',
        ],
      },
      {
        id: 'termination',
        heading: '8. Account Suspension & Termination',
        content: [
          'Fugluck reserves the right to suspend, restrict, or terminate any account that violates these Terms of Service, engages in fraudulent activity, or poses a security risk to other players. In the event of account closure, you may request data access in accordance with our Privacy Policy.',
        ],
      },
      {
        id: 'contact',
        heading: '9. Contact & Inquiries',
        content: [
          'For legal inquiries, terms interpretation, or general support, please visit our Help Center (/help) or submit an inquiry through our Contact page (/contact).',
        ],
      },
    ],
    relatedSlugs: ['privacy', 'rules', 'diamonds', 'fair-play', 'disputes'],
  },

  privacy: {
    type: 'PRIVACY',
    slug: 'privacy',
    title: 'Privacy Policy',
    subtitle: 'How Fugluck collects, uses, protects, and handles your personal information.',
    lastUpdated: 'September 25, 2026',
    version: CURRENT_POLICY_VERSIONS.PRIVACY,
    summary:
      'This notice summarizes the account, gameplay, and simulated ledger data used by the current platform. It does not describe data collection by features that are not active.',
    sections: [
      {
        id: 'information-collected',
        heading: '1. Information We Collect',
        content: [
          'We collect only the categories of information necessary to deliver and secure our services:',
          '• Account Information: Username, email address, password hash (salted using Argon2id / bcrypt; we never store plain-text passwords), and account creation timestamps.',
          '• Gameplay records: match history and results. For certified TEST GEL competition runs, the platform stores server-owned authority results. Casual scores are reported by the client and are not treated as verified TEST GEL results. The current platform does not collect frame-by-frame replay input logs for score reconstruction.',
          '• Ledger records: timestamps, currency amounts, and event details for Coins, historical Diamonds, and simulated TEST / SANDBOX GEL accounting.',
          '• Technical and security data: limited request and authentication information used for sessions, rate limiting, and security review. Exact retention can depend on operational and security requirements.',
        ],
      },
      {
        id: 'how-we-use-data',
        heading: '2. How We Use Your Information',
        content: [
          'Your information is used strictly for:',
          '• Authenticating your identity and maintaining your active login session.',
          '• Operating matchmaking queues and pair-matching players.',
          '• Running account, matchmaking, game-authority, and simulated accounting features that are currently available.',
          '• Maintaining sandbox ledger accuracy and security controls. Historical currency records may be retained for account history and audit.',
          '• Communicating critical account notices (e.g. email verification, password reset links).',
        ],
      },
      {
        id: 'data-retention',
        heading: '3. Data Retention & Ledger Integrity',
        content: [
          '• Match history and server authority result records are retained according to the current application schema. Historical input-log fields may remain in older records or database structure; the current product does not use replay reconstruction.',
          '• Wallet and sandbox ledger records are retained as financial history; settled ledger records are not manually rewritten through player-facing controls.',
          '• Verification and password reset tokens expire automatically after 24 hours and 1 hour respectively.',
        ],
      },
      {
        id: 'sharing-and-security',
        heading: '4. Information Sharing & Security Measures',
        content: [
          'We do not sell, rent, or monetize your personal data. We disclose information only to third-party infrastructure providers (e.g. cloud database hosting, transactional email delivery) who are under strict confidentiality obligations.',
          'We implement industry-standard technical safeguards, including HTTP-only cookies, PostgreSQL connection encryption (SSL/TLS), salted password hashing, and advisory-locked database transactions.',
        ],
      },
      {
        id: 'user-rights',
        heading: '5. Your Rights & Data Access Requests',
        content: [
          'You have the right to request a copy of your personal data, request correction of inaccurate profile data, or request account closure. For detailed instructions on exercising your data rights, please see our Data Rights & Account Closure page (/data-rights).',
        ],
      },
    ],
    relatedSlugs: ['terms', 'cookies', 'data-rights', 'security'],
  },

  cookies: {
    type: 'COOKIES',
    slug: 'cookies',
    title: 'Cookie & Storage Policy',
    subtitle: 'Transparent disclosure of browser storage, sessions, and cookies used on Fugluck.',
    lastUpdated: 'August 18, 2026',
    version: CURRENT_POLICY_VERSIONS.COOKIES,
    summary:
      'Fugluck utilizes strictly necessary cookies and local browser storage to provide secure session management, language preferences, and active match resumption. We do not use third-party advertising tracking cookies.',
    sections: [
      {
        id: 'storage-overview',
        heading: '1. What Storage Technologies We Use',
        content: [
          'Fugluck utilizes standard browser storage technologies:',
          '• HTTP-Only Session Cookies: Secure, server-set cookies (e.g., fugluck_session) used solely to maintain authenticated user sessions.',
          '• LocalStorage: Client-side storage used to remember your preferred language (en, ka, ru) and client-side UI preferences.',
          '• SessionStorage: Temporary browser memory used to store active match references so a match can be reconnected if you refresh during play.',
        ],
      },
      {
        id: 'strict-necessity',
        heading: '2. Strictly Necessary Classification',
        content: [
          'All cookies and storage items currently employed by Fugluck are strictly necessary for the technical operation, security, and authentication of the website.',
          'Because we do not deploy third-party advertising trackers or invasive marketing pixels, our storage usage qualifies as essential under major data protection frameworks.',
        ],
      },
      {
        id: 'managing-cookies',
        heading: '3. Managing Browser Storage',
        content: [
          'You can configure your browser settings to block or delete cookies. However, disabling essential cookies will prevent you from logging in, maintaining an authenticated session, or participating in matchmaking.',
        ],
      },
    ],
    relatedSlugs: ['privacy', 'security', 'terms'],
  },

  rules: {
    type: 'RULES',
    slug: 'rules',
    title: 'Competition & Game Rules',
    subtitle: 'Rules for casual play and currently supported TEST / SANDBOX GEL competitions.',
    lastUpdated: 'September 25, 2026',
    version: CURRENT_POLICY_VERSIONS.RULES,
    summary:
      'Rules depend on the selected play mode. Only enabled, certified TEST / SANDBOX GEL competitions use the server-authoritative result flow described here.',
    sections: [
      {
        id: 'skill-foundation',
        heading: '1. Competition Formats',
        content: [
          'Practice and casual modes are separate from TEST GEL prize competitions. Casual scores may be client-reported and do not qualify for TEST GEL prizes.',
          'TEST / SANDBOX GEL competition entries use fixed platform-defined terms: game, head-to-head format, entry fee, participant capacity, and predetermined prize. Players cannot choose a money stake or bet on outside events.',
        ],
      },
      {
        id: 'game-categories',
        heading: '2. Game Categories & Rules',
        content: [
          'Practice and casual games include the listed arcade and quiz titles, subject to current availability.',
          'Only Space Blaster (`space-blaster-rv001-v1`) and Cyber Hopper (`cyber-hopper-rv001-v1`) are currently certified for TEST / SANDBOX GEL prize competitions. Neon Runner and Pixel Ninja Dash are not certified for that use. Speed Trivia Clash and True / False Sprint are outside the current prize-competition scope.',
        ],
      },
      {
        id: 'dynamic-scaling',
        heading: '3. Live Authority and Result Integrity',
        content: [
          'For a certified TEST GEL game, the browser sends controls and displays snapshots. The server owns score-bearing simulation state, movement, collision, and terminal results. The server binds controls to the authenticated participant and active authority session.',
        ],
      },
      {
        id: 'settlement-rules',
        heading: '4. Outcomes and Simulated Accounting',
        content: [
          '• Winner: the result is decided from the server-owned game state and the instance rules.',
          '• Prize: the eligible winner receives the predetermined simulated prize recorded for that instance.',
          '• Free entry: a freeroll labels entry as FREE; its predetermined prize remains a separate value.',
          '• Tie, failed admission, or system interruption: the authority and accounting lifecycle decide whether the instance is settled or voided/refunded. No result is manually assigned to a player.',
          'TEST / SANDBOX GEL has no real-world value. There are no active deposits, withdrawals, redemptions, or payment rails.',
        ],
      },
    ],
    relatedSlugs: ['terms', 'fair-play', 'diamonds', 'refunds'],
  },

  diamonds: {
    type: 'DIAMONDS',
    slug: 'diamonds',
    title: 'Historical Diamond Records',
    subtitle: 'Legacy policy information retained for historical Diamond and wallet records.',
    lastUpdated: 'September 25, 2026',
    version: CURRENT_POLICY_VERSIONS.DIAMONDS,
    summary:
      'This page explains historical Diamond records only. Diamonds are retired from new play and funding. This archive does not offer or describe an active Diamond purchase, competition, or cash-out service.',
    sections: [
      {
        id: 'dual-currency',
        heading: '1. Historical Diamond Records',
        note: 'DIAMONDS — RETIRED / LEGACY. This page is provided to help interpret historical account records.',
        content: [
          'Historical Diamond balances and ledger records may appear in account history. New Diamond play, purchases, grants, and matching are retired.',
          'Current competitions use simulated TEST / SANDBOX GEL under the separate Competition Rules. TEST GEL is not a replacement payment balance and has no real-world value.',
        ],
      },
      {
        id: 'append-only-ledger',
        heading: '2. Append-Only Financial Ledger',
        content: [
          'Historical currency entries are preserved for account history and audit. This archive does not create a new Diamond balance or authorize new transfers.',
        ],
      },
      {
        id: 'current-status',
        heading: '3. Current Operating Status',
        content: [
          'There is no active Diamond shop, purchase, stake, or cash-out feature. The current platform does not process real-money deposits, withdrawals, card payments, or bank transfers.',
        ],
      },
    ],
    relatedSlugs: ['withdrawals', 'refunds', 'rules', 'terms'],
  },

  withdrawals: {
    type: 'WITHDRAWALS',
    slug: 'withdrawals',
    title: 'Withdrawal Service — Unavailable',
    subtitle: 'Status information for a service that is not active.',
    lastUpdated: 'September 25, 2026',
    version: CURRENT_POLICY_VERSIONS.WITHDRAWALS,
    summary:
      'Withdrawals and redemption are not available. No future withdrawal terms or eligibility are offered on this page.',
    sections: [
      {
        id: 'withdrawal-lifecycle',
        heading: '1. Current availability',
        content: [
          'The platform has no active withdrawal, redemption, cash-out, deposit, bank, card, or payment-provider functionality.',
          'TEST / SANDBOX GEL is simulated and cannot be converted to or paid as real money.',
        ],
      },
      {
        id: 'eligibility-and-aml',
        heading: '2. Historical balances',
        content: [
          'Historical Diamond balances are retained as legacy records and do not create an active withdrawal right or available redemption service.',
        ],
      },
      {
        id: 'status-notice',
        heading: '3. Questions',
        content: [
          'For questions about an existing account record, use the Contact and Support page. This status page does not promise a future service or a launch date.',
        ],
      },
    ],
    relatedSlugs: ['diamonds', 'refunds', 'eligibility', 'disputes'],
  },

  refunds: {
    type: 'REFUNDS',
    slug: 'refunds',
    title: 'Refund Policy',
    subtitle: 'How simulated TEST GEL entries are handled when a competition is not completed.',
    lastUpdated: 'September 25, 2026',
    version: CURRENT_POLICY_VERSIONS.REFUNDS,
    summary:
      'This policy describes simulated TEST GEL competition entries. There are no real-money deposits or purchases to refund in the current product.',
    sections: [
      {
        id: 'match-refunds',
        heading: '1. Match Entry Refunds (Automatic)',
        content: [
          'A TEST GEL competition that is tied, cannot pass live admission, or cannot produce a valid terminal result may be voided and its reserved or captured simulated entries returned through the accounting lifecycle.',
          'The exact result is recorded on the competition instance. A player or administrator cannot use a casual client score to create a TEST GEL prize result.',
        ],
      },
      {
        id: 'completed-matches',
        heading: '2. Legitimate Completed Matches',
        content: [
          'A valid completed TEST GEL competition is settled from the server-owned result and predetermined instance terms. TEST GEL is simulated and is not a cash payment or real-value prize.',
        ],
      },
      {
        id: 'purchase-refunds',
        heading: '3. Diamond Purchase Refunds',
        content: [
          'There are no active Diamond purchases or real-money payment processors in the current product. Historical Diamond records remain available as legacy account history.',
        ],
      },
    ],
    relatedSlugs: ['terms', 'rules', 'diamonds', 'withdrawals'],
  },

  'responsible-play': {
    type: 'RESPONSIBLE_PLAY',
    slug: 'responsible-play',
    title: 'Responsible Play Policy',
    subtitle: 'Suggestions for balanced, enjoyable arcade play.',
    lastUpdated: 'September 25, 2026',
    version: CURRENT_POLICY_VERSIONS.RESPONSIBLE_PLAY,
    summary:
      'Fugluck is dedicated to providing a safe, enjoyable, and balanced gaming environment. We encourage all players to compete responsibly and maintain healthy boundaries.',
    sections: [
      {
        id: 'principles',
        heading: '1. Principles of Responsible Play',
        content: [
          '• Play for Entertainment: Competitive gaming should be an enjoyable test of skill, reflex, and strategy.',
          '• Take breaks and set time boundaries that work for you.',
          '• TEST / SANDBOX GEL is simulated and cannot be deposited or withdrawn. It has no real-world value.',
          '• Balance with Life: Gaming should complement, not replace, daily responsibilities, work, or social connections.',
        ],
      },
      {
        id: 'player-controls',
        heading: '2. Available Account Controls',
        content: [
          'Available controls depend on the current release. You can stop playing at any time and contact support about your account.',
          'Account closure and data requests are handled through the Contact and Data Rights pages.',
        ],
      },
      {
        id: 'seeking-help',
        heading: '3. Recognizing Unhealthy Habits',
        content: [
          'If gaming begins to cause stress, financial strain, or emotional distress, we strongly encourage reaching out to professional support organizations and taking an extended break from competitive play.',
        ],
      },
    ],
    relatedSlugs: ['terms', 'eligibility', 'data-rights', 'fair-play'],
  },

  eligibility: {
    type: 'ELIGIBILITY',
    slug: 'eligibility',
    title: 'Eligibility & Jurisdictional Restrictions',
    subtitle: 'Age requirements, geographic access rules, and regulatory compliance standards.',
    lastUpdated: 'August 18, 2026',
    version: CURRENT_POLICY_VERSIONS.ELIGIBILITY,
    summary:
      'This page describes current account access limits. It does not state a legal or regulatory classification or approval.',
    sections: [
      {
        id: 'age-requirements',
        heading: '1. Age Requirements',
        content: [
          'Eligibility rules are subject to product and legal review. The current release does not publish a final minimum age or jurisdictional classification here. Do not treat this page as legal advice or a statement of regulatory approval.',
        ],
      },
      {
        id: 'jurisdiction-rules',
        heading: '2. Geographical & Jurisdictional Availability',
        content: [
          'Availability may be restricted by operational decisions or applicable requirements. Contact the platform for current access questions. This page does not make a legal classification of the product.',
        ],
      },
      {
        id: 'identity-verification',
        heading: '3. Identity Verification (KYC)',
        content: [
          'The current product has no real-money deposit, payment, or withdrawal service. No KYC/AML thresholds or withdrawal eligibility are being offered by this page.',
        ],
      },
    ],
    relatedSlugs: ['terms', 'responsible-play', 'withdrawals', 'fair-play'],
  },

  'fair-play': {
    type: 'FAIR_PLAY',
    slug: 'fair-play',
    title: 'Fair Play & Anti-Cheating Policy',
    subtitle: 'Account, session, and competition integrity expectations.',
    lastUpdated: 'September 25, 2026',
    version: CURRENT_POLICY_VERSIONS.FAIR_PLAY,
    summary:
      'Attempts to interfere with accounts, sessions, game operation, or competition results are prohibited. The safeguards described here vary by mode and do not guarantee that every misuse will be detected automatically.',
    sections: [
      {
        id: 'prohibited-tools',
        heading: '1. Prohibited Tools & Behaviors',
        content: [
          'The following activities constitute severe fair-play violations:',
          '• Automated inputs or tools intended to manipulate play or competition outcomes.',
          '• Client Modification & Injection: Modifying the client JavaScript bundle, injecting memory modifications, or manipulating fixed-timestep loops.',
          '• Attempts to exploit timing, disconnects, or another user’s account.',
          '• Collusion or attempts to manipulate competition participation or results.',
        ],
      },
      {
        id: 'detection-systems',
        heading: '2. Anti-Cheat & Verification Technology',
        content: [
          '• Certified TEST GEL competitions run the score-bearing simulation on the server. Authenticated controls are bound to an authority session; score and terminal results are server-owned.',
          '• Casual scores are client-reported and are not eligible for TEST GEL prizes.',
          '• Authority admission, input-shape, session binding, reconnect fencing, and accounting controls are tested by the project’s current automated checks.',
        ],
      },
      {
        id: 'penalties',
        heading: '3. Consequences of Violations',
        content: [
          'Reported conduct may be reviewed and may result in account restrictions under the applicable procedures. Staff do not manually rewrite settled results or ledger records.',
        ],
      },
    ],
    relatedSlugs: ['rules', 'terms', 'security', 'disputes'],
  },

  disputes: {
    type: 'DISPUTES',
    slug: 'disputes',
    title: 'Complaints & Disputes Policy',
    subtitle: 'Our formal procedure for reviewing match issues, balance inquiries, and player complaints.',
    lastUpdated: 'August 18, 2026',
    version: CURRENT_POLICY_VERSIONS.DISPUTES,
    summary:
      'We provide a structured, transparent process for investigating match disputes, ledger discrepancies, and account moderation appeals.',
    sections: [
      {
        id: 'dispute-categories',
        heading: '1. Types of Inquiries & Disputes',
        content: [
          'Players may submit dispute inquiries regarding:',
          '• Match Result Inquiries: Suspected opponent cheating, abnormal disconnects, or score verification disputes.',
          '• Ledger & Balance Discrepancies: Inquiries regarding escrow debits, victory payouts, or missing grants.',
          '• Account Moderation Appeals: Review requests for suspended or restricted accounts.',
        ],
      },
      {
        id: 'resolution-process',
        heading: '2. Investigation & Resolution Procedure',
        content: [
          '1. Submission: Submit an inquiry via our Help Center (/help) or Contact page (/contact) with match ID, timestamps, and details.',
          '2. Record Review: For a certified TEST GEL competition, an administrator may review the authority decision, competition lifecycle, and sandbox ledger records. Casual scores do not have replay-based verification.',
          '3. Resolution: Findings are communicated to the player. If an error is verified, compensating ledger adjustments are made.',
        ],
      },
    ],
    relatedSlugs: ['terms', 'fair-play', 'refunds', 'contact'],
  },

  'data-rights': {
    type: 'DATA_RIGHTS',
    slug: 'data-rights',
    title: 'Data Rights & Account Closure',
    subtitle: 'How to request your personal data, update information, or request account closure.',
    lastUpdated: 'August 18, 2026',
    version: CURRENT_POLICY_VERSIONS.DATA_RIGHTS,
    summary:
      'Understand your rights regarding data access, portability, correction, and account closure. Learn how financial and anti-cheat records are retained under regulatory obligations.',
    sections: [
      {
        id: 'available-rights',
        heading: '1. Your Personal Data Rights',
        content: [
          'Under applicable data protection frameworks, you have the right to:',
          '• Access & Export: Request an electronic copy of your profile data, match history, and ledger records.',
          '• Correction: Request correction of inaccurate profile or account information.',
          '• Account Closure: Request permanent closure of your Fugluck account.',
        ],
      },
      {
        id: 'retention-exceptions',
        heading: '2. Financial & Security Retention Exceptions',
        content: [
          'When an account is closed, your login credentials are deleted and personal identifiers removed.',
          'However, append-only financial ledger entries (ledger_entries) and match settlement records (match_settlements) must be retained in an anonymized format to preserve platform financial balance integrity, audit trails, and anti-money laundering compliance.',
        ],
      },
      {
        id: 'how-to-submit',
        heading: '3. Submitting a Data Request',
        content: [
          'To submit a data request or request account closure, please submit an inquiry through our Contact page (/contact) from your registered email address.',
        ],
      },
    ],
    relatedSlugs: ['privacy', 'terms', 'security', 'contact'],
  },

  security: {
    type: 'SECURITY',
    slug: 'security',
    title: 'Platform Security Information',
    subtitle: 'Technical safeguards, encryption standards, and architectural security controls.',
    lastUpdated: 'August 18, 2026',
    version: CURRENT_POLICY_VERSIONS.SECURITY,
    summary:
      'Fugluck is engineered with enterprise security controls: salted password hashing, HTTP-only session cookies, PostgreSQL advisory transaction locks, and server-side rate limiters.',
    sections: [
      {
        id: 'authentication-security',
        heading: '1. Authentication & Session Protection',
        content: [
          '• Passwords: Salted and hashed using strong cryptographic algorithms (Argon2id / bcrypt). Plaintext passwords are never stored or logged.',
          '• Sessions: Authenticated sessions use HTTP-only, SameSite=Lax cookies with Secure flags in production environments.',
          '• Brute-Force & Lockout Protection: Server-side rate limiters restrict repeated login and registration attempts, with automatic IP-based lockouts for repeated administrative failures.',
        ],
      },
      {
        id: 'financial-architecture',
        heading: '2. Financial & Ledger Safeguards',
        content: [
          '• Non-Negative Balance Trigger: PostgreSQL trigger ledger_non_negative_guard guarantees balances cannot be overdrawn at the storage engine layer.',
          '• Advisory Transaction Locks: Dual-user advisory locks prevent race conditions across concurrent matchmaking and wallet operations.',
          '• Single-Settlement Integrity: Primary key constraints ensure every match settles exactly once.',
        ],
      },
      {
        id: 'responsible-disclosure',
        heading: '3. Responsible Vulnerability Disclosure',
        content: [
          'If you discover a security vulnerability or bug, please report it privately through our Contact page (/contact). We investigate all reports promptly.',
        ],
      },
    ],
    relatedSlugs: ['privacy', 'terms', 'fair-play', 'data-rights'],
  },

  about: {
    type: 'ABOUT',
    slug: 'about',
    title: 'About Fugluck',
    subtitle: 'An online arcade with practice, casual play, and simulated competition features.',
    lastUpdated: 'September 25, 2026',
    version: CURRENT_POLICY_VERSIONS.ABOUT,
    summary:
      'Fugluck is an online arcade platform. It offers local practice and casual games, plus a limited set of platform-defined TEST / SANDBOX GEL competitions.',
    sections: [
      {
        id: 'our-mission',
        heading: '1. Our Mission',
        content: [
          'Players can choose practice or casual games. A separate TEST / SANDBOX GEL flow is available only for enabled, certified competition templates.',
          'Space Blaster and Cyber Hopper are currently certified for the live prize-competition authority. Neon Runner and Pixel Ninja Dash are not certified; Speed Trivia Clash and True / False Sprint are outside the current prize scope.',
        ],
      },
      {
        id: 'fairness-first',
        heading: '2. Fairness by Design',
        content: [
          'For certified TEST GEL competitions, the server runs the score-bearing state and decides results. Casual scores are client-reported and are not used to award TEST GEL prizes.',
        ],
      },
      {
        id: 'game-modes',
        heading: '3. Play Your Way',
        content: [
          '• Practice: play locally without a competition entry.',
          '• Casual play: use non-monetary COINS where available.',
          '• TEST / SANDBOX GEL competitions: platform-set entry fees and predetermined simulated prizes. No real-money deposit, withdrawal, redemption, card processing, bank integration, or payment rail is active.',
        ],
      },
    ],
    relatedSlugs: ['rules', 'fair-play', 'diamonds', 'contact'],
  },

  contact: {
    type: 'CONTACT',
    slug: 'contact',
    title: 'Contact & Support',
    subtitle: 'Get in touch with the Fugluck team for player support, inquiries, or feedback.',
    lastUpdated: 'August 18, 2026',
    version: CURRENT_POLICY_VERSIONS.CONTACT,
    summary:
      'Have a question about a match, your account, or platform rules? Our support team is here to help. Explore our Help Center or reach out directly.',
    sections: [
      {
        id: 'support-channels',
        heading: '1. Support & Communication Channels',
        content: [
          '• Help Center: Browse our comprehensive FAQ and troubleshooting guides at /help for instant answers to common questions.',
          '• Account & Match Inquiries: Submit match IDs and detailed logs to our support desk for fast resolution.',
          '• Legal & Compliance: For formal policy, regulatory, or privacy inquiries, contact our compliance team.',
        ],
      },
      {
        id: 'response-expectations',
        heading: '2. Response Times & Operating Hours',
        content: [
          'Our support desk reviews inquiries in the order received. For fastest assistance with match-related questions, always include the match ID, game title, and relevant timestamps.',
        ],
      },
    ],
    relatedSlugs: ['about', 'disputes', 'terms', 'privacy'],
  },
}
