import type { Account, Quota } from "../shared/types.ts";

/** Lowest remaining account-wide window: the limit a request hits first.
    Model-scoped windows (Opus, Fable…) never mark the whole account out. */
export function floor(account: Account): number | null {
  const windows = account.quota?.windows ?? [];
  const shared = windows.filter((w) => !w.scoped);
  const values = (shared.length ? shared : windows)
    .map((w) => w.remainingPercent)
    .filter((v): v is number => v !== null);
  return values.length ? Math.min(...values) : null;
}
const plans = new Map([
  ["plus", "Plus"],
  ["pro", "Pro"],
  ["team", "Team"],
  ["business", "Business"],
  ["enterprise", "Enterprise"],
  ["edu", "Edu"],
  ["free", "Free"],
]);
/** Provider plan identifiers such as self_serve_business_prolite, made readable. */
export function planLabel(plan: string): string {
  const text = plans.get(plan) ?? plan.replace(/[_-]+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function accountLabel(account: Account): string {
  const organization =
    account.organizationName ||
    (account.organizationUuid
      ? `Organization ${account.organizationUuid.slice(0, 8)}`
      : "");
  return organization
    ? `${organization}${account.name !== "Claude" ? ` · ${account.name}` : ""}`
    : account.name;
}

export function count(n: number): string {
  return new Intl.NumberFormat("en", {
    notation: n >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(n);
}
export function resetIn(value: string | null, now = Date.now()): string {
  if (!value) return "no reset time";
  const seconds = Math.ceil((new Date(value).getTime() - now) / 1000);
  if (!Number.isFinite(seconds)) return "no reset time";
  if (seconds <= 0) return "reset due · refresh";
  const minutes = Math.ceil(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  return days > 0
    ? `resets ${days}d ${hours % 24}h`
    : hours > 0
      ? `resets ${hours}h ${minutes % 60}m`
      : `resets ${minutes}m`;
}
export function exactTime(value: string | null): string {
  return value
    ? new Date(value).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : "The provider has not reported a reset time.";
}
export function age(value?: string): string {
  if (!value) return "not checked yet";
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60_000);
  return mins < 1
    ? "checked just now"
    : `checked ${mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h`} ago`;
}
export function isQuotaStale(quota?: Quota, now = Date.now()): boolean {
  return Boolean(
    quota &&
    (quota.status === "error" ||
      now - new Date(quota.checkedAt).getTime() > 300_000),
  );
}
