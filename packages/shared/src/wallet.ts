// Balances are derived from the append-only ledger on the server.

export type Currency = "COINS";

export type WalletBalances = {
  coins: number;
  sandboxGelMinor?: number;
  sandboxGelReservedMinor?: number;
};

export const SIGNUP_COIN_GRANT = 1000;
