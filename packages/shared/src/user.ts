// The user shape sent to the client — never includes passwordHash.
import type { AdminRole } from "./admin";
import type { WalletBalances } from "./wallet";

export type PublicUser = {
  id: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  role?: AdminRole;
  gamesPlayed: number;
  gamesWon: number;
  isEmailVerified: boolean;
  createdAt: string;
  // Derived from the ledger at response time (see wallet/ledger.ts).
  balances: WalletBalances;
};
