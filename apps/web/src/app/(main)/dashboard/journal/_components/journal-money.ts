export function journalMoney(value: number) {
  if (value !== 0 && Math.abs(value) < 0.01) return `${value < 0 ? "−" : ""}<0.01`;
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
