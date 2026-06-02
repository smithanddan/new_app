export type NormalizedPrice = {
  amount: number;
  currency: string;
};

export function normalizePrice(input: string, defaultCurrency = "RUB"): NormalizedPrice | null {
  if (!input) return null;

  const cleaned = input
    .replace(/\s+/g, "")
    .replace(",", ".")
    .replace(/[^\d.₽$€]/g, "");

  const match = cleaned.match(/\d+(\.\d+)?/);
  if (!match) return null;

  let currency = defaultCurrency;
  if (cleaned.includes("$")) currency = "USD";
  if (cleaned.includes("€")) currency = "EUR";
  if (cleaned.includes("₽")) currency = "RUB";

  return {
    amount: Number(match[0]),
    currency
  };
}
