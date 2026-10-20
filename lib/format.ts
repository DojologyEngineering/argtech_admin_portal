import type { Farmer } from "./types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdPrecise = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Money with cents, like the Buyer and Agent apps: totals read $137.50, not $138. */
export function money(value: number): string {
  return usd.format(value);
}

/** Same as `money`; kept for per-kg prices and break-even figures. */
export function moneyPrecise(value: number): string {
  return usdPrecise.format(value);
}

export function num(value: number, maxDp = 2): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: maxDp }).format(
    value,
  );
}

export function kg(value: number): string {
  return `${num(value)} kg`;
}

export function hectares(value: number): string {
  return `${num(value, 3)} ha`;
}

export function percent(fraction: number | null, dp = 1): string {
  if (fraction === null) return "—";
  return `${(fraction * 100).toFixed(dp)}%`;
}

/** yyyy-mm-dd -> "12 Mar 2026". Falls back to the raw string if unparseable. */
export function prettyDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function farmerName(f: Pick<Farmer, "firstName" | "lastName">): string {
  return `${f.firstName} ${f.lastName}`.trim();
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** "Siem Reap, Angkor Chum" from the parts that are actually filled in. */
export function locationLabel(parts: {
  province?: string;
  district?: string;
}): string {
  return [parts.province, parts.district].filter(Boolean).join(", ") || "—";
}

export function dash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}
