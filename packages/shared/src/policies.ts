// Centralized legal, policy, and compliance version identifiers and metadata.
// Code is the source of truth. Version bumps here mandate re-consent where configured.

export type PolicyType =
  | "TERMS"
  | "PRIVACY"
  | "COOKIES"
  | "RULES"
  | "DIAMONDS"
  | "WITHDRAWALS"
  | "REFUNDS"
  | "RESPONSIBLE_PLAY"
  | "ELIGIBILITY"
  | "FAIR_PLAY"
  | "DISPUTES"
  | "DATA_RIGHTS"
  | "SECURITY"
  | "ABOUT"
  | "CONTACT"
  | "SANDBOX_NOTICE";

export const CURRENT_POLICY_VERSIONS: Record<PolicyType, string> = {
  TERMS: "draft-1.0",
  PRIVACY: "draft-1.0",
  COOKIES: "2026-08-18",
  RULES: "draft-1.0",
  DIAMONDS: "draft-1.0",
  WITHDRAWALS: "2026-08-18",
  REFUNDS: "2026-08-18",
  RESPONSIBLE_PLAY: "2026-08-18",
  ELIGIBILITY: "2026-08-18",
  FAIR_PLAY: "draft-1.0",
  DISPUTES: "2026-08-18",
  DATA_RIGHTS: "2026-08-18",
  SECURITY: "2026-08-18",
  ABOUT: "draft-1.0",
  CONTACT: "draft-1.0",
  SANDBOX_NOTICE: "draft-1.0",
};

export type PolicyAcceptanceRecord = {
  id: string;
  userId: string;
  policyType: PolicyType;
  policyVersion: string;
  acceptedAt: string;
  source: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type SignupAcceptedPolicies = {
  termsVersion: string;
  privacyVersion: string;
};

export type PolicyNavItem = {
  id: string;
  titleKey: string;
  path: string;
  category: "FUGLUCK" | "HELP" | "LEGAL";
};

export const POLICY_NAV_ITEMS: PolicyNavItem[] = [
  // Product information
  { id: "ABOUT", titleKey: "policies.nav.about", path: "/about", category: "FUGLUCK" },
  { id: "HOW_IT_WORKS", titleKey: "policies.nav.howItWorks", path: "/how-it-works", category: "FUGLUCK" },
  { id: "GAMES_SKILL", titleKey: "policies.nav.games", path: "/games-and-skill", category: "FUGLUCK" },
  { id: "COMPETITIONS", titleKey: "policies.nav.competitions", path: "/competition-model", category: "FUGLUCK" },
  { id: "ENTRY_PRIZES", titleKey: "policies.nav.entryPrizes", path: "/entry-fees-prizes", category: "FUGLUCK" },

  // Help and contact
  { id: "HELP", titleKey: "policies.nav.help", path: "/help", category: "HELP" },
  { id: "FAQ", titleKey: "policies.nav.faq", path: "/faq", category: "HELP" },
  { id: "CONTACT", titleKey: "policies.nav.contact", path: "/contact", category: "HELP" },

  // Legal and policy documents
  { id: "TERMS", titleKey: "policies.nav.terms", path: "/terms", category: "LEGAL" },
  { id: "PRIVACY", titleKey: "policies.nav.privacy", path: "/privacy", category: "LEGAL" },
  { id: "RULES", titleKey: "policies.nav.rules", path: "/rules", category: "LEGAL" },
  { id: "SANDBOX_NOTICE", titleKey: "policies.nav.sandboxNotice", path: "/sandbox-notice", category: "LEGAL" },
  { id: "FAIR_PLAY", titleKey: "policies.nav.fairPlay", path: "/fair-play", category: "LEGAL" },
  { id: "LEGAL_INDEX", titleKey: "policies.nav.legalIndex", path: "/legal", category: "LEGAL" },
];
