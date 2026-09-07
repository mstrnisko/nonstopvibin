import "./activity.css";

import { useEffect, useState } from "react";
import { Download, Search } from "lucide-react";
import type {
  ProfileState,
  UsageRecord,
  UsageSummary,
} from "../shared/types.ts";
import { providerLabel } from "../shared/providers.ts";
import { api } from "./api.ts";
import { Empty } from "./components.tsx";
import { accountLabel, count } from "./format.ts";

const ranges = [
  { days: 1, label: "24h" },
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 3650, label: "all" },
] as const;

const percentage = (part: number, whole: number, digits = 0) =>
  whole ? `${((part / whole) * 100).toFixed(digits)}%` : "0%";

const percentile = (values: number[], value: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * value) - 1)];
};

interface Bucket {
  key: number;
  label: string;
  accessibleLabel: string;
  total: number;
  failed: number;
  showLabel: boolean;
}

function activityBuckets(records: UsageRecord[], days: number): Bucket[] {
  const now = new Date();
  const hourly = days === 1;
  const end = hourly
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours())
    : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const interval = hourly ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const datedRecords = records
    .map((record) => ({ record, date: new Date(record.timestamp) }))
    .filter(({ date }) => Number.isFinite(date.getTime()));
  const oldest = datedRecords.reduce(
    (minimum, { date }) => Math.min(minimum, date.getTime()),
    end.getTime(),
  );
  const bucketCount = hourly
    ? 24
    : days === 3650
      ? Math.max(1, Math.ceil((end.getTime() - oldest) / interval) + 1)
      : days;
  const start = end.getTime() - (bucketCount - 1) * interval;
  const every = Math.max(1, Math.ceil(bucketCount / 7));
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const date = new Date(start + index * interval);
    return {
      key: date.getTime(),
      label: hourly
        ? date.toLocaleTimeString([], { hour: "numeric" })
        : date.toLocaleDateString([], {
            month: bucketCount > 8 ? "numeric" : "short",
            day: "numeric",
          }),
      accessibleLabel: hourly
        ? date.toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "numeric",
          })
        : date.toLocaleDateString([], {
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
      total: 0,
      failed: 0,
      showLabel: index % every === 0 || index === bucketCount - 1,
    };
  });
  for (const { record, date } of datedRecords) {
    const bucketDate = hourly
      ? new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          date.getHours(),
        )
      : new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const index = Math.round((bucketDate.getTime() - start) / interval);
    if (buckets[index]) {
      buckets[index].total += 1;
      if (record.failed) buckets[index].failed += 1;
    }
  }
  return buckets;
}

export function ActivityPage({ profile }: { profile: ProfileState }) {
  const [days, setDays] = useState(7);
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [summary, setSummary] = useState<UsageSummary>();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [failures, setFailures] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopped = false;
    let busy = false;
    let initial = true;
    setLoading(true);
    setRecords([]);
    setSummary(undefined);
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        const data = await api<{
          records: UsageRecord[];
          summary: UsageSummary;
        }>(`/profiles/${profile.id}/usage?days=${days}`);
        if (!stopped) {
          setRecords(data.records);
          setSummary(data.summary);
          setError("");
        }
      } catch (e) {
        if (!stopped)
          setError(e instanceof Error ? e.message : "Could not load activity.");
      } finally {
        busy = false;
        if (initial && !stopped) setLoading(false);
        initial = false;
      }
    };
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 5000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [profile.id, days]);

  const accounts = new Map(
    profile.accounts.map((account) => [
      account.authIndex || account.id,
      account,
    ]),
  );
  const subscription = (record: UsageRecord) => {
    const account = accounts.get(record.account);
    return account ? accountLabel(account) : "";
  };
  const recordAccount = (record: UsageRecord) =>
    subscription(record) || providerLabel(record.provider);
  const filtered = records.filter(
    (record) =>
      (!failures || record.failed) &&
      `${record.model} ${providerLabel(record.provider)} ${subscription(record)} ${accounts.get(record.account)?.email ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );

  const totalRequests = summary?.requests ?? 0;
  const failedRequests = summary?.failed ?? 0;
  const totalTokens = summary?.totalTokens ?? 0;
  // "all" has no fixed window and the sample is capped at 500, so a daily
  // rate is only honest when the sample covers the whole history.
  const elapsedDays =
    days !== 3650
      ? days
      : records.length && records.length < 500
        ? Math.max(
            1,
            (Date.now() -
              Math.min(
                ...records.map((record) =>
                  new Date(record.timestamp).getTime(),
                ),
              )) /
              86_400_000,
          )
        : null;
  const failedCodes = new Map<number, number>();
  for (const record of records) {
    if (record.failed)
      failedCodes.set(
        record.statusCode,
        (failedCodes.get(record.statusCode) ?? 0) + 1,
      );
  }
  const topStatus = [...failedCodes].sort((a, b) => b[1] - a[1])[0];
  const cacheDenominator =
    (summary?.cachedTokens ?? 0) + (summary?.inputTokens ?? 0);
  const cacheRate = cacheDenominator
    ? ((summary?.cachedTokens ?? 0) / cacheDenominator) * 100
    : 0;
  const p95Latency = percentile(
    records.map((record) => record.latencyMs),
    0.95,
  );
  const tokenParts = [
    { label: "cached", value: summary?.cachedTokens ?? 0, className: "cached" },
    { label: "input", value: summary?.inputTokens ?? 0, className: "input" },
    { label: "output", value: summary?.outputTokens ?? 0, className: "output" },
    {
      label: "reasoning",
      value: summary?.reasoningTokens ?? 0,
      className: "reasoning",
    },
  ];
  const tokenMixTotal = tokenParts.reduce((sum, part) => sum + part.value, 0);
  const buckets = activityBuckets(records, days);
  const maxBucket = Math.max(1, ...buckets.map((bucket) => bucket.total));

  const accountGroups = new Map<
    string,
    { label: string; requests: number; latency: number; failed: number }
  >();
  for (const record of records) {
    const key = record.account || record.provider;
    const group = accountGroups.get(key) ?? {
      label: recordAccount(record),
      requests: 0,
      latency: 0,
      failed: 0,
    };
    group.requests += 1;
    group.latency += record.latencyMs;
    if (record.failed) group.failed += 1;
    accountGroups.set(key, group);
  }
  const byAccount = [...accountGroups.values()].sort(
    (a, b) => b.requests - a.requests,
  );

  const modelGroups = new Map<
    string,
    { requests: number; tokens: number; failed: number; latencies: number[] }
  >();
  for (const record of records) {
    const group = modelGroups.get(record.model) ?? {
      requests: 0,
      tokens: 0,
      failed: 0,
      latencies: [],
    };
    group.requests += 1;
    group.tokens += record.totalTokens;
    if (record.failed) group.failed += 1;
    group.latencies.push(record.latencyMs);
    modelGroups.set(record.model, group);
  }
  const byModel = [...modelGroups].sort(
    (a, b) => b[1].requests - a[1].requests,
  );

  function exportCSV() {
    const keys: Array<keyof UsageRecord> = [
      "timestamp",
      "provider",
      "account",
      "model",
      "inputTokens",
      "outputTokens",
      "cachedTokens",
      "reasoningTokens",
      "totalTokens",
      "latencyMs",
      "statusCode",
    ];
    const escape = (value: UsageRecord[keyof UsageRecord]) =>
      `"${String(value)
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""')}"`;
    const csv = [
      keys.join(","),
      ...filtered.map((record) =>
        keys.map((key) => escape(record[key])).join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nonstopvibin-${profile.slug}-activity.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="activity-page">
      <div className="activity-range">
        <h2 className="label" id="usage-title">
          Usage · {ranges.find((r) => r.days === days)?.label}
        </h2>
        <div className="segmented" aria-label="Time range">
          {ranges.map((range) => (
            <button
              type="button"
              className={days === range.days ? "active" : ""}
              aria-pressed={days === range.days}
              key={range.days}
              onClick={() => setDays(range.days)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <div role="alert" className="inline-error">
          {error}
        </div>
      )}
      {loading ? (
        <div className="loading" role="status">
          Loading activity…
        </div>
      ) : (
        <>
          <section className="activity-overview" aria-label="Usage summary">
            {[
              {
                label: "Requests",
                value: count(totalRequests),
                detail: elapsedDays
                  ? `${count(totalRequests / elapsedDays)} / day`
                  : "all time",
              },
              {
                label: "Total tokens",
                value: count(totalTokens),
                detail: `${count(totalRequests ? totalTokens / totalRequests : 0)} / request`,
              },
              {
                label: "Failed",
                value: count(failedRequests),
                detail: `${percentage(failedRequests, totalRequests, 1)}${topStatus ? ` · top ${topStatus[0]}` : ""}`,
                tone: failedRequests ? "warn" : "",
              },
              {
                label: "Cache hit",
                value: `${cacheRate.toFixed(0)}%`,
                detail: `${count(summary?.cachedTokens ?? 0)} cached`,
              },
              {
                label: "p95 latency",
                value: `${(p95Latency / 1000).toFixed(2)}s`,
                detail: `latest ${count(records.length)} reqs`,
              },
              {
                label: "Avg output",
                value: count(
                  totalRequests
                    ? (summary?.outputTokens ?? 0) / totalRequests
                    : 0,
                ),
                detail: "tokens / request",
              },
            ].map((stat) => (
              <div className="activity-stat" key={stat.label}>
                <span className="label">{stat.label}</span>
                <strong className={stat.tone ? `text-${stat.tone}` : undefined}>
                  {stat.value}
                </strong>
                <code>{stat.detail}</code>
              </div>
            ))}
          </section>

          <section className="token-mix" aria-labelledby="token-mix-title">
            <div className="activity-section-heading">
              <h2 className="label" id="token-mix-title">
                Token mix
              </h2>
              <code>{count(totalTokens)} total</code>
            </div>
            <div
              className="token-mix-bar"
              role="img"
              aria-label={tokenParts
                .map((part) => `${part.label} ${count(part.value)}`)
                .join(", ")}
            >
              {tokenParts.map((part) => (
                <span
                  className={part.className}
                  key={part.label}
                  style={{ width: `${percentage(part.value, tokenMixTotal)}` }}
                />
              ))}
            </div>
            <div className="token-legend">
              {tokenParts.map((part) => (
                <span className={part.className} key={part.label}>
                  <i aria-hidden="true" /> {part.label} {count(part.value)}
                </span>
              ))}
            </div>
          </section>

          {!records.length ? (
            <Empty title="Ready for your first request">
              Connect an agent to this profile. Requests, token counts, and
              timing will appear here.
            </Empty>
          ) : (
            <>
              <section
                className="activity-section requests-chart"
                aria-labelledby="requests-title"
              >
                <div className="activity-section-heading">
                  <h2 className="label" id="requests-title">
                    Requests / {days === 1 ? "hour" : "day"}
                  </h2>
                </div>
                <div className="chart-plot">
                  {buckets.map((bucket) => {
                    const height = (bucket.total / maxBucket) * 100;
                    const failedHeight = bucket.total
                      ? (bucket.failed / bucket.total) * 100
                      : 0;
                    return (
                      <div
                        className="chart-column"
                        key={bucket.key}
                        title={`${bucket.accessibleLabel}: ${bucket.total} requests, ${bucket.failed} failed`}
                      >
                        <div
                          className={`chart-bar ${bucket.total ? "" : "empty"}`}
                          style={{ height: `${height}%` }}
                        >
                          <span
                            className="chart-failed"
                            style={{ height: `${failedHeight}%` }}
                          />
                        </div>
                        <code>{bucket.showLabel ? bucket.label : ""}</code>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section
                className="activity-section"
                aria-labelledby="accounts-title"
              >
                <div className="activity-section-heading">
                  <h2 className="label" id="accounts-title">
                    By account
                  </h2>
                  <code>{count(records.length)} sampled requests</code>
                </div>
                <div className="table-scroll">
                  <table className="data-table account-activity-table">
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Share</th>
                        <th className="num">Reqs</th>
                        <th className="num">Avg latency</th>
                        <th className="num">Err</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byAccount.map((group) => (
                        <tr key={group.label}>
                          <td>{group.label}</td>
                          <td>
                            <div className="account-share">
                              <div className="meter-track">
                                <div
                                  style={{
                                    width: percentage(
                                      group.requests,
                                      records.length,
                                    ),
                                  }}
                                />
                              </div>
                              <span>
                                {percentage(group.requests, records.length)}
                              </span>
                            </div>
                          </td>
                          <td className="num">{count(group.requests)}</td>
                          <td className="num">
                            {(group.latency / group.requests / 1000).toFixed(2)}
                            s
                          </td>
                          <td
                            className={`num ${group.failed ? "text-warn" : ""}`}
                          >
                            {percentage(group.failed, group.requests, 1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section
                className="activity-section"
                aria-labelledby="models-title"
              >
                <div className="activity-section-heading">
                  <h2 className="label" id="models-title">
                    By model
                  </h2>
                </div>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th className="num">Reqs</th>
                        <th className="num">Tokens</th>
                        <th className="num">Err</th>
                        <th className="num">p50 latency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byModel.map(([model, group]) => (
                        <tr key={model}>
                          <td>{model}</td>
                          <td className="num">{count(group.requests)}</td>
                          <td className="num">{count(group.tokens)}</td>
                          <td
                            className={`num ${group.failed ? "text-warn" : ""}`}
                          >
                            {percentage(group.failed, group.requests, 1)}
                          </td>
                          <td className="num">
                            {(percentile(group.latencies, 0.5) / 1000).toFixed(
                              2,
                            )}
                            s
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section
                className="activity-section request-log"
                aria-labelledby="request-log-title"
              >
                <div className="activity-section-heading request-log-heading">
                  <h2 className="label" id="request-log-title">
                    Request log
                  </h2>
                </div>
                <div className="activity-toolbar">
                  <label className="search-field">
                    <Search size={14} aria-hidden="true" />
                    <input
                      placeholder="Filter model, account, or email"
                      aria-label="Search activity"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className={`button small ${failures ? "active" : ""}`}
                    aria-pressed={failures}
                    onClick={() => setFailures((current) => !current)}
                  >
                    Errors only
                  </button>
                  <button
                    className="button small export-activity"
                    onClick={exportCSV}
                    disabled={!filtered.length}
                  >
                    <Download size={14} /> Export
                  </button>
                </div>
                {!filtered.length ? (
                  <Empty title="No matching requests">
                    Try a model, account, or email, or turn off the error
                    filter.
                  </Empty>
                ) : (
                  <div className="table-scroll">
                    <table className="data-table request-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Model</th>
                          <th>Account</th>
                          <th className="num">Tokens</th>
                          <th className="num">Lat ms</th>
                          <th className="num">Code</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((record) => (
                          <tr key={record.id}>
                            <td
                              title={new Date(
                                record.timestamp,
                              ).toLocaleString()}
                            >
                              {new Date(record.timestamp).toLocaleTimeString(
                                [],
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                },
                              )}
                            </td>
                            <td>
                              {record.model}
                              {record.stream && (
                                <small className="stream-label">
                                  {" "}
                                  · stream
                                </small>
                              )}
                            </td>
                            <td>{recordAccount(record)}</td>
                            <td className="num">{count(record.totalTokens)}</td>
                            <td className="num">{count(record.latencyMs)}</td>
                            <td
                              className={`num ${
                                record.statusCode >= 500
                                  ? "text-bad"
                                  : record.statusCode === 429
                                    ? "text-warn"
                                    : ""
                              }`}
                            >
                              {record.statusCode}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
          <p className="activity-note">
            Token counts come from the proxy; they are not a subscription bill.
            {records.length >= 500 && (
              <>
                {" "}
                Derived tables use the latest 500 requests; summary totals
                include the full range.
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}
