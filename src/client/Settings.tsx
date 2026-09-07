import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { AppState, ProfileState } from "../shared/types.ts";
import { api } from "./api.ts";
import { CopyButton } from "./components.tsx";
import "./settings.css";

export function SettingsPage({
  state,
  profile,
  refresh,
  onError,
}: {
  state: AppState;
  profile?: ProfileState;
  refresh(): Promise<void>;
  onError(message: string): void;
}) {
  const [login, setLogin] = useState(false);
  const [name, setName] = useState(profile?.name ?? "");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (window.nonstopvibin)
      window.nonstopvibin
        .getLoginItem()
        .then(setLogin)
        .catch((e) => onError(e.message));
  }, [onError]);
  useEffect(() => {
    setName(profile?.name ?? "");
  }, [profile?.id, profile?.name]);
  return (
    <div className="settings-page">
      <header className="page-header">
        <div className="page-title">
          <h1>Settings</h1>
          <code>nonstopvibin {state.version} · local</code>
        </div>
      </header>
      <div className="page-body">
        <div className="settings-content">
          <section className="settings-section">
            <h2>Desktop</h2>
            <div className="setting-row">
              <div className="setting-copy">
                <h3>Start at login</h3>
                <p>
                  {state.desktop
                    ? "Keep the proxy and quota menu available when you sign in."
                    : "Available in the desktop app, along with the menu-bar quota view."}
                </p>
              </div>
              <input
                type="checkbox"
                role="switch"
                aria-label="Start at login"
                disabled={!state.desktop}
                checked={login}
                onChange={async (e) => {
                  try {
                    setLogin(
                      await window.nonstopvibin!.setLoginItem(e.target.checked),
                    );
                  } catch (err) {
                    onError(
                      err instanceof Error
                        ? err.message
                        : "Could not change login setting.",
                    );
                  }
                }}
              />
            </div>
            <div className="setting-row">
              <div className="setting-copy">
                <h3>Closing the window</h3>
                <p>
                  The desktop app stays in your menu bar. Use Quit to stop all
                  profile proxies.
                </p>
              </div>
            </div>
          </section>
          {profile && (
            <section className="settings-section">
              <h2>{profile.name}</h2>
              <div className="setting-row">
                <div className="setting-copy">
                  <h3>Profile name</h3>
                  <p>
                    Renaming keeps the same endpoint and API key, so agent
                    setups continue to work.
                  </p>
                </div>
                <form
                  className="rename-form"
                  aria-label="Rename profile"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await api(`/profiles/${profile.id}`, "PATCH", { name });
                      await refresh();
                      setSaved(true);
                      setTimeout(() => setSaved(false), 2500);
                    } catch (err) {
                      onError(
                        err instanceof Error ? err.message : "Rename failed.",
                      );
                    }
                  }}
                >
                  <label className="visually-hidden" htmlFor="profile-name">
                    Profile name
                  </label>
                  <input
                    id="profile-name"
                    required
                    maxLength={60}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <button className="button">
                    {saved ? "Saved" : "Save name"}
                  </button>
                </form>
              </div>
              <div className="setting-row">
                <div className="setting-copy">
                  <h3>Keep sessions on the same account</h3>
                  <p>
                    Prefer the same account within a conversation to reuse
                    prompt caches. Failover stays in this profile.
                  </p>
                </div>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label="Keep sessions on the same account"
                  checked={profile.sessionAffinity}
                  onChange={async (e) => {
                    try {
                      await api(`/profiles/${profile.id}`, "PATCH", {
                        sessionAffinity: e.target.checked,
                      });
                      await refresh();
                    } catch (err) {
                      onError(
                        err instanceof Error ? err.message : "Update failed.",
                      );
                    }
                  }}
                />
              </div>
            </section>
          )}
          <section className="settings-section">
            <h2>Under the hood</h2>
            <dl className="settings-facts">
              <dt>Proxy core</dt>
              <dd>
                CLIProxyAPI {state.coreVersion}{" "}
                <span
                  className={state.coreAvailable ? "text-good" : "text-bad"}
                >
                  {state.coreAvailable ? "· Bundled" : "· Missing"}
                </span>
              </dd>
              <dt>Agent API</dt>
              <dd>
                <code>{state.gateway}/v1</code>
                <CopyButton text={`${state.gateway}/v1`} onError={onError} />
              </dd>
              <dt>Credential vault</dt>
              <dd>{state.storage}</dd>
              <dt>OAuth storage</dt>
              <dd>
                Separate directories per profile, readable only by your OS user.
              </dd>
              <dt>Quota refresh</dt>
              <dd>
                Every 2 minutes while running. No model requests are used to
                check quotas.
              </dd>
              <dt>Usage history</dt>
              <dd>Local SQLite. No prompt or response content is recorded.</dd>
            </dl>
            {state.desktop && (
              <button
                className="button"
                onClick={async () => {
                  try {
                    await window.nonstopvibin!.revealData();
                  } catch (e) {
                    onError(
                      e instanceof Error
                        ? e.message
                        : "Could not open data folder.",
                    );
                  }
                }}
              >
                Open data folder <ChevronRight size={14} />
              </button>
            )}
          </section>
          {state.errors.length > 0 && (
            <section className="settings-section">
              <h2>Recent service notices</h2>
              <div className="settings-notices">
                {state.errors.map((e) => (
                  <p key={e} className="inline-error">
                    {e}
                  </p>
                ))}
              </div>
            </section>
          )}
          <p className="settings-footer">
            Local software · subscriptions remain with their providers
          </p>
        </div>
      </div>
    </div>
  );
}
