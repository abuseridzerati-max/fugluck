// Balances are derived from the append-only ledger on the server.

export type Currency = "COINS";

export type WalletBalances = {
  coins: number;
  sandboxGelMinor?: number;
  sandboxGelReservedMinor?: number;
};

export const SIGNUP_COIN_GRANT = 1000;
export const MIN_COIN_WAGER = 1;
export const DEFAULT_COIN_ENTRY = 1;
export const COIN_STAKE_PRESETS = [0, 1, 10, 25, 50, 100] as const;
