export type FAQCategory = {
  id: string
  title: string
  description: string
  icon: string
}

export type FAQItem = {
  id: string
  categoryId: string
  question: string
  answer: string
  tags: string[]
  relatedPolicySlug?: string
  relatedPolicyLabel?: string
}

export const FAQ_CATEGORIES: FAQCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Play modes, account needs, and simulated competitions.',
    icon: '🚀',
  },
  {
    id: 'playing-matches',
    title: 'Playing Matches',
    description: 'Matchmaking, rules, scoring, disconnects, and winner determination.',
    icon: '🎮',
  },
  {
    id: 'diamonds-and-wallet',
    title: 'Historical Diamonds & Wallet',
    description: 'Understanding COINS vs DIAMONDS, ledger balances, and transactions.',
    icon: '💎',
  },
  {
    id: 'fairness-and-security',
    title: 'Fairness & Anti-Cheat',
    description: 'How server verification works, anti-cheat detection, and fair play.',
    icon: '🛡️',
  },
  {
    id: 'account-and-login',
    title: 'Account & Security',
    description: 'Registration, email verification, passwords, and security.',
    icon: '🔐',
  },
  {
    id: 'friends-and-social',
    title: 'Friends & Social',
    description: 'Friend requests, inviting friends to private matches, and links.',
    icon: '👥',
  },
  {
    id: 'privacy-and-data',
    title: 'Privacy & Data Rights',
    description: 'Personal data protection, account closure, and data requests.',
    icon: '📜',
  },
  {
    id: 'support-and-help',
    title: 'Support & Inquiries',
    description: 'Disputes, reporting bugs, and getting in touch with our team.',
    icon: '💬',
  },
]

export const FAQ_ITEMS: FAQItem[] = [
  // Getting Started
  {
    id: 'what-is-fugluck',
    categoryId: 'getting-started',
    question: 'What is Fugluck?',
    answer:
      'Fugluck is an online arcade platform with local practice, casual play, and a limited set of platform-defined TEST / SANDBOX GEL competitions.',
    tags: ['about', 'platform', 'introduction', 'basics'],
    relatedPolicySlug: 'about',
    relatedPolicyLabel: 'About Fugluck',
  },
  {
    id: 'is-fugluck-free',
    categoryId: 'getting-started',
    question: 'Is Fugluck free to play?',
    answer:
      'Practice and casual play are available without entering a TEST GEL competition. Account-based competitions use simulated TEST / SANDBOX GEL and may require sign-in. No real-money play is active.',
    tags: ['free', 'cost', 'practice', 'coins'],
    relatedPolicySlug: 'rules',
    relatedPolicyLabel: 'Competition Rules',
  },
  {
    id: 'what-is-practice-mode',
    categoryId: 'getting-started',
    question: 'What is Practice Mode?',
    answer:
      'Practice Mode runs a game locally without competition entry, opponent matching, or prize settlement.',
    tags: ['practice', 'offline', 'single player', 'training'],
    relatedPolicySlug: 'rules',
    relatedPolicyLabel: 'Game Rules',
  },
  {
    id: 'coins-vs-diamonds',
    categoryId: 'getting-started',
    question: 'What is the difference between Coins and Diamonds?',
    answer:
      'COINS are non-monetary casual play points. DIAMONDS are retired from new play and funding, while historical records remain. TEST / SANDBOX GEL is simulated and used only in platform-defined competitions; it has no real-world value.',
    tags: ['coins', 'diamonds', 'currencies', 'difference'],
    relatedPolicySlug: 'diamonds',
    relatedPolicyLabel: 'Historical Diamond & Wallet Policy',
  },

  // Playing Matches
  {
    id: 'how-matchmaking-works',
    categoryId: 'playing-matches',
    question: 'How does matchmaking work?',
    answer:
      'Casual play uses its available game flow. In TEST / SANDBOX GEL competitions, the platform sets the game, fixed entry fee, participant capacity, and predetermined prize in advance. Players do not choose a money stake or bet on an outside event.',
    tags: ['matchmaking', 'competition', 'entry fee', 'pairing'],
    relatedPolicySlug: 'rules',
    relatedPolicyLabel: 'Matchmaking Rules',
  },
  {
    id: 'how-is-winner-determined',
    categoryId: 'playing-matches',
    question: 'How is the match winner determined?',
    answer:
      'Casual scores are reported by the client and do not qualify for TEST GEL prizes. For enabled certified TEST GEL competitions, the server runs the score-bearing game state and decides the result from server-owned state.',
    tags: ['winner', 'score', 'outcome', 'payout'],
    relatedPolicySlug: 'rules',
    relatedPolicyLabel: 'Competition Rules',
  },
  {
    id: 'what-happens-in-draw',
    categoryId: 'playing-matches',
    question: 'What happens if a match ends in a draw (tie)?',
    answer:
      'If a certified TEST GEL competition ends in a tied result, its lifecycle records the tie and returns simulated entry funds under the competition accounting rules. It does not issue real money.',
    tags: ['draw', 'tie', 'refund', 'equal score'],
    relatedPolicySlug: 'refunds',
    relatedPolicyLabel: 'Refund Policy',
  },
  {
    id: 'what-happens-on-disconnect',
    categoryId: 'playing-matches',
    question: 'What happens if I disconnect during a match?',
    answer:
      'Reconnect behavior depends on the mode and current competition state. A certified live competition has a reconnect window; if a valid result cannot be established, the system applies its terminal refund or forfeit rule. Check the instance result for its final status.',
    tags: ['disconnect', 'connection', 'forfeit', 'grace window'],
    relatedPolicySlug: 'rules',
    relatedPolicyLabel: 'Competition Rules',
  },
  {
    id: 'what-is-voided-match',
    categoryId: 'playing-matches',
    question: 'What is a voided match?',
    answer:
      'A voided TEST GEL competition is one where the authority cannot produce an eligible result or a system failure prevents a valid completion. The simulated entry amounts are returned through the accounting lifecycle; no winner is invented.',
    tags: ['void', 'interruption', 'server restart', 'crash recovery'],
    relatedPolicySlug: 'refunds',
    relatedPolicyLabel: 'Refund Policy',
  },

  // Diamonds & Wallet
  {
    id: 'how-do-diamonds-work',
    categoryId: 'diamonds-and-wallet',
    question: 'What happened to Diamonds?',
    answer:
      'Diamonds are retired from active play and funding. Historical Diamond transactions remain preserved in the ledger and under the historical wallet policy.',
    tags: ['diamonds', 'wallet', 'legacy balance'],
    relatedPolicySlug: 'diamonds',
    relatedPolicyLabel: 'Historical Diamond & Wallet Policy',
  },
  {
    id: 'can-diamonds-be-withdrawn',
    categoryId: 'diamonds-and-wallet',
    question: 'Can Diamonds be cashed out for real money?',
    answer:
      'No. DIAMONDS are retired and there is no withdrawal or redemption service. TEST / SANDBOX GEL is simulated, has no real-world value, and cannot be withdrawn or redeemed.',
    tags: ['cash out', 'withdrawal', 'real money', 'payout'],
    relatedPolicySlug: 'withdrawals',
    relatedPolicyLabel: 'Withdrawal Service — Unavailable',
  },
  {
    id: 'where-can-i-see-wallet-history',
    categoryId: 'diamonds-and-wallet',
    question: 'Where can I see my transaction and wallet history?',
    answer:
      'Open Wallet from the navigation menu to view available balances and transaction history. Historical Diamond rows are retained for account history; current TEST GEL entries are simulated ledger records.',
    tags: ['wallet', 'history', 'ledger', 'transactions'],
    relatedPolicySlug: 'diamonds',
    relatedPolicyLabel: 'Wallet Terms',
  },

  // Fairness & Anti-Cheat
  {
    id: 'how-are-scores-verified',
    categoryId: 'fairness-and-security',
    question: 'How does Fugluck verify scores?',
    answer:
      'For certified TEST GEL competitions, the server owns the active game simulation and result. The client sends controls and receives snapshots; it does not submit the competition score. Casual match results are client-reported and are not prize-authoritative.',
    tags: ['anti cheat', 'score verification', 'server authority', 'security'],
    relatedPolicySlug: 'fair-play',
    relatedPolicyLabel: 'Fair Play Policy',
  },
  {
    id: 'can-players-use-bots',
    categoryId: 'fairness-and-security',
    question: 'Can players use bots or automated scripts?',
    answer:
      'Automated play and attempts to interfere with accounts, sessions, or competition results are prohibited. The platform may review reports and available server records; it does not claim that every prohibited tool is automatically detected.',
    tags: ['bots', 'macros', 'cheating', 'banning'],
    relatedPolicySlug: 'fair-play',
    relatedPolicyLabel: 'Fair Play Policy',
  },
  {
    id: 'how-are-gameplay-reports-reviewed',
    categoryId: 'fairness-and-security',
    question: 'How are gameplay reports reviewed?',
    answer:
      'For a certified TEST GEL competition, support can review the stored authority result, instance lifecycle, and accounting records. The product does not promise automatic detection of every prohibited tool or reconstruct gameplay from input logs.',
    tags: ['gameplay review', 'server records', 'fair play', 'support'],
    relatedPolicySlug: 'fair-play',
    relatedPolicyLabel: 'Fair Play Policy',
  },

  // Account & Security
  {
    id: 'how-do-i-register',
    categoryId: 'account-and-login',
    question: 'How do I register an account?',
    answer:
      'Click "Sign up" in the top navigation bar, choose a unique username (3-20 characters), create a strong password (minimum 8 characters), and provide an optional email address for password recovery and verification. Check the agreement box to accept our Terms of Service and Privacy Policy.',
    tags: ['signup', 'register', 'account', 'create'],
    relatedPolicySlug: 'terms',
    relatedPolicyLabel: 'Terms of Service',
  },
  {
    id: 'why-verify-email',
    categoryId: 'account-and-login',
    question: 'Why should I verify my email address?',
    answer:
      'Email verification secures your account, allows you to recover your account if you forget your password, and ensures eligibility for social features and future real-money competitions.',
    tags: ['email', 'verification', 'security', 'recovery'],
    relatedPolicySlug: 'privacy',
    relatedPolicyLabel: 'Privacy Policy',
  },
  {
    id: 'how-to-reset-password',
    categoryId: 'account-and-login',
    question: 'How do I reset a forgotten password?',
    answer:
      'Click "Log in", then click "Forgot password?". Enter your registered email or username to receive a secure password reset link valid for 1 hour.',
    tags: ['password', 'reset', 'forgot password', 'recovery'],
    relatedPolicySlug: 'security',
    relatedPolicyLabel: 'Security Info',
  },
  {
    id: 'can-i-have-multiple-accounts',
    categoryId: 'account-and-login',
    question: 'Can I create multiple accounts?',
    answer:
      'No. Operating multiple accounts by a single individual is prohibited under our Terms of Service to prevent rating manipulation and matchmaking abuse.',
    tags: ['multiple accounts', 'puppet accounts', 'rules', 'one account'],
    relatedPolicySlug: 'terms',
    relatedPolicyLabel: 'Terms of Service',
  },

  // Friends & Social
  {
    id: 'how-friend-requests-work',
    categoryId: 'friends-and-social',
    question: 'How do friend requests work?',
    answer:
      'Visit the Friends page (/friends) and enter another player’s username to send a friend request. Once accepted, you can see their online status and send instant private match invitations.',
    tags: ['friends', 'friend requests', 'social', 'invites'],
    relatedPolicySlug: 'rules',
    relatedPolicyLabel: 'Game Rules',
  },
  {
    id: 'how-guest-invite-links-work',
    categoryId: 'friends-and-social',
    question: 'How do instant guest invite links work?',
    answer:
      'Click "Create Instant Friend Challenge Link" in the game launch modal to generate an invite link. Invited players can join free casual play without a balance amount.',
    tags: ['guest links', 'instant invite', 'free play', 'share'],
    relatedPolicySlug: 'rules',
    relatedPolicyLabel: 'Game Rules',
  },

  // Privacy & Data
  {
    id: 'what-data-is-stored',
    categoryId: 'privacy-and-data',
    question: 'What information does Fugluck store?',
    answer:
      'We store your username, salted password hash, optional email address, match history records, and append-only ledger entries. We do not store plain-text passwords or third-party advertising tracking cookies.',
    tags: ['privacy', 'data storage', 'information', 'cookies'],
    relatedPolicySlug: 'privacy',
    relatedPolicyLabel: 'Privacy Policy',
  },
  {
    id: 'how-to-close-account',
    categoryId: 'privacy-and-data',
    question: 'How do I close my account or request data deletion?',
    answer:
      'Submit a request via our Contact page (/contact) or visit Data Rights & Account Closure (/data-rights). We will delete your login credentials and personal identifiers while retaining anonymized ledger records for audit integrity.',
    tags: ['close account', 'delete data', 'account deletion', 'data rights'],
    relatedPolicySlug: 'data-rights',
    relatedPolicyLabel: 'Data Rights',
  },

  // Support
  {
    id: 'how-to-report-match-issue',
    categoryId: 'support-and-help',
    question: 'How do I report a suspicious match or score discrepancy?',
    answer:
      'Copy the competition or match reference from your history and contact support. For TEST GEL competitions, staff can review the stored authority result, lifecycle, and accounting records. The current service does not reconstruct gameplay from input-log replay.',
    tags: ['report', 'dispute', 'cheating', 'support'],
    relatedPolicySlug: 'disputes',
    relatedPolicyLabel: 'Disputes Policy',
  },
  {
    id: 'how-to-contact-support',
    categoryId: 'support-and-help',
    question: 'How do I contact Fugluck support?',
    answer:
      'You can reach our team directly through our Contact page at /contact or browse our Help Center categories for instant guidance.',
    tags: ['contact', 'support', 'help desk', 'inquiries'],
    relatedPolicySlug: 'contact',
    relatedPolicyLabel: 'Contact Page',
  },
]
