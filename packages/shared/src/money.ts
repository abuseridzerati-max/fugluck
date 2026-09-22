// Monetary domain primitives using integer minor units (e.g. 500 = 5.00 GEL).
// Floating-point arithmetic is strictly prohibited for monetary calculations.
// COINS are strictly non-monetary virtual gameplay points and must NOT be converted
// to or represented as MoneyAmount.

export type ISO4217Currency = "GEL" | "USD" | "EUR";

export type MoneyAmount = {
  currency: ISO4217Currency;
  amountMinor: number; // Strictly non-negative integer
};

export function createMoney(amountMinor: number, currency: ISO4217Currency = "GEL"): MoneyAmount {
  if (!Number.isInteger(amountMinor) || amountMinor < 0) {
    throw new Error(`Invalid monetary minor amount: ${amountMinor}. Must be a non-negative integer.`);
  }
  if (currency !== "GEL" && currency !== "USD" && currency !== "EUR") {
    throw new Error(`Unsupported currency: ${currency}. Supported: GEL, USD, EUR.`);
  }
  return { currency, amountMinor };
}

export function formatMoneyDisplay(money: MoneyAmount): string {
  if (!Number.isInteger(money.amountMinor) || money.amountMinor < 0) {
    throw new Error(`Invalid monetary minor amount: ${money.amountMinor}. Must be a non-negative integer.`);
  }
  const major = (money.amountMinor / 100).toFixed(2);
  switch (money.currency) {
    case "GEL":
      return `₾${major} GEL`;
    case "USD":
      return `$${major} USD`;
    case "EUR":
      return `€${major} EUR`;
    default:
      return `${major} ${(money as MoneyAmount).currency}`;
  }
}
