const cents = value => {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(value ?? ""));
  if (!match) return null;
  const amount = BigInt(match[2]) * 100n + BigInt((match[3] || "").padEnd(2, "0"));
  return match[1] ? -amount : amount;
};

function sum(rows, key) {
  const values = rows.map(row => cents(row[key]));
  if (values.includes(null)) return null;
  return values.reduce((total, amount) => total + amount, 0n);
}

export function invoicePeriodTotals(report, period) {
  if (!report?.included) return null;
  const rows = report.rows.filter(row => period === "year" ||
    period === "m" + row.month || period === "q" + Math.ceil(row.month / 3));
  const amounts = direction => {
    const selected = rows.filter(row => row.direction === direction);
    return { net: sum(selected, "net"), gross: sum(selected, "gross") };
  };
  return { purchase: amounts("INCOMING"), sales: amounts("OUTGOING"),
    count: rows.reduce((total, row) => total + row.count, 0) };
}

export function formatInvoicePLN(amount) {
  if (amount == null) return "—";
  const positive = amount < 0n ? -amount : amount;
  return (amount < 0n ? "−" : "") + new Intl.NumberFormat("pl-PL").format(positive / 100n) +
    "," + String(positive % 100n).padStart(2, "0") + " zł";
}
