import { useState } from "react";
import { ArrowRight, ChevronRight, RefreshCw } from "lucide-react";
import type { AppState } from "../shared/types.ts";
import { api } from "./api.ts";
import { Empty, Logo, meterLevel } from "./components.tsx";
import {
  accountLabel,
  age,
  exactTime,
  isQuotaStale,
  resetIn,
} from "./format.ts";
import "./tray.css";

export function TrayView({
  state,
  refresh,
}: {
  state: AppState;
  refresh(): Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="tray-view">
      <header>
        <Logo
          state={
            state.profiles.some((p) => p.runtime === "running")
              ? "running"
              : state.profiles.some((p) => p.runtime === "starting")
                ? "paused"
                : "stopped"
          }
        />
        <button
          className="icon-button"
          aria-label="Refresh all quotas"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              for (const p of state.profiles.filter(
                (p) => p.runtime === "running",
              ))
                await api(`/profiles/${p.id}/refresh`, "POST");
              await refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Refresh failed.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <RefreshCw size={15} className={busy ? "spin" : ""} />
        </button>
      </header>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="tray-scroll">
        {!state.profiles.length && (
          <Empty title="Your subscriptions at a glance">
            Create your first profile in the app to see its quotas here.
          </Empty>
        )}
        {state.profiles.map((p) => (
          <section key={p.id}>
            <button
              className="tray-profile"
              onClick={() => window.nonstopvibin?.showWindow(p.id)}
            >
              <strong>{p.name}</strong>
              <span className={p.runtime === "running" ? "text-good" : ""}>
                {p.runtime === "running" ? "running" : "stopped"}
              </span>
              <ChevronRight size={14} />
            </button>
            {p.accounts.length ? (
              p.accounts.map((a) => (
                <div
                  className={`tray-account ${isQuotaStale(a.quota) ? "stale" : ""} ${a.disabled ? "disabled" : ""}`}
                  key={a.id}
                >
                  <div className="tray-account-name">
                    <strong title={accountLabel(a)}>{accountLabel(a)}</strong>
                    <small>{a.email || a.status}</small>
                  </div>
                  {a.quota?.windows.length ? (
                    a.quota.windows.map((w) => (
                      <div className="tray-window" key={w.label}>
                        <span>{w.label}</span>
                        <div
                          className={`meter-track ${meterLevel(w.remainingPercent)}`}
                        >
                          <div
                            style={{ width: `${w.remainingPercent ?? 0}%` }}
                          />
                        </div>
                        <strong className={meterLevel(w.remainingPercent)}>
                          {w.remainingPercent === null
                            ? "—"
                            : `${Math.round(w.remainingPercent)}%`}
                        </strong>
                        <small title={exactTime(w.resetsAt)}>
                          {resetIn(w.resetsAt)}
                        </small>
                      </div>
                    ))
                  ) : (
                    <small className="tray-unavailable">
                      {a.quota?.status === "unavailable"
                        ? "Quota unavailable for this provider"
                        : "Quota not checked"}
                    </small>
                  )}
                  {a.quota?.status === "error" && (
                    <small className="tray-error text-bad">
                      Check failed · showing last reading
                    </small>
                  )}
                  <small className="tray-age">
                    {isQuotaStale(a.quota) && a.quota ? "stale · " : ""}
                    {age(a.quota?.checkedAt)}
                  </small>
                </div>
              ))
            ) : (
              <p className="tray-empty">No subscriptions yet.</p>
            )}
          </section>
        ))}
      </div>
      <footer>
        <span>
          {state.profiles.reduce((sum, p) => sum + p.accounts.length, 0)}{" "}
          subscriptions · local
        </span>
        <button
          className="text-button"
          onClick={() => window.nonstopvibin?.showWindow()}
        >
          Open app <ArrowRight size={13} />
        </button>
      </footer>
    </div>
  );
}
