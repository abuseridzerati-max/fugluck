// Balances are derived from the append-only ledger on the server. DIAMONDS
// remains in this type only to read preserved historical records.

export type Currency = "COINS" | "DIAMONDS";

export type WalletBalances = {
  coins: number;
  diamonds: number;
  sandboxGelMinor?: number;
  sandboxGelReservedMinor?: number;
};

export const SIGNUP_COIN_GRANT = 1000;
