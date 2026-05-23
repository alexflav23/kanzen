// Shared money formatting — integer minor units → display, design style (£ / S$).
export function fmtMoney(minor: number, currency: string): string {
  const whole = Math.round(minor / 100).toLocaleString("en-GB");
  if (currency === "GBP") return `£${whole}`;
  if (currency === "SGD") return `S$${whole}`;
  return `${currency} ${whole}`;
}
