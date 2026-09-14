<p align="center">
  <img src="public/icon.png" width="88" height="88" alt="NonstopVibin icon">
</p>

# NonstopVibin

A desktop app for connecting Claude Code, Codex, and pi to your AI subscriptions
and API accounts. Runs a local proxy on macOS and Linux using
[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI).

Keep work, personal, and project accounts in separate profiles. Each profile has
its own API key and endpoint. Requests use only that profile's accounts and fail
when none can serve them.

[Setup](#setup) · [Build from source](#build-from-source) · [Provider support](docs/providers.md) · [Development](docs/development.md)

![Subscriptions and quota windows](docs/design/subscriptions.png)

## Accounts, quotas, and activity

- Sign in to Claude or ChatGPT/Codex, connect OpenCode Go with a subscription key,
  add a compatible API, or import CLIProxyAPI account files.
- Use **Fill first** to prioritize accounts or **Round robin** to spread requests.
  New profiles use fill first with session affinity enabled.
- Check account quota windows and reset times in the app or menu bar. Review and
  use available Codex banked resets with explicit confirmation.
- View request history, token counts, and estimated API value. Charts, tables,
  and CSV exports use the latest 500 requests in the selected period; summary
  totals cover the full period.

Quota reporting depends on the provider. Cross-provider models are opt-in for
Claude Code and Codex and use experimental protocol translation. Live subscription
inference, quota checks, and reset redemption remain unverified; see
[provider support](docs/providers.md) for the tested scope.

<details>
<summary>Activity</summary>

![Activity, token usage, and request history](docs/design/activity.png)

</details>

## Setup

Install your coding agent separately, then:

1. Create a profile and choose **Add subscription**.
2. Sign in, enter an API key, or import an account file into that profile.
3. Start the profile and open **Connect agents**.
4. Select Claude Code, Codex, or pi and follow the connection and launch
   instructions. Claude Code requires a project folder.

Keep NonstopVibin and the profile running while you work. Selecting another
profile in the app changes the view, not an agent's existing conversation.
See [agent setup](docs/agent-setup.md) for client versions, model selection,
reconnecting, and disconnecting.

Closing the window leaves the proxy running in the menu bar. **Quit** stops it.
**Start at login** is optional in Settings.

## Build from source

This is a prerelease. Install [Bun 1.4.2](https://bun.com/docs/installation) and
Git. On macOS, also install Xcode Command Line Tools (`xcode-select --install`).
From a checkout of this repository:

```sh
bun run setup
bun run build
bun run start
```

Setup installs locked dependencies and downloads the pinned CLIProxyAPI core.
To create an installer, run the matching command on the target system:

| Release target       | Command              | Output in `release/` |
| -------------------- | -------------------- | -------------------- |
| macOS, Apple Silicon | `bun run dist:mac`   | DMG                  |
| Linux, x86_64        | `bun run dist:linux` | AppImage and deb     |

Packaged apps do not require Bun. Updates are manual until the GitHub release feed
is enabled; see [release and update setup](docs/releases.md). macOS builds are unsigned
and not notarized until signing is configured; installation and tray behavior in
an interactive Linux desktop session still need verification. See
[release requirements](SECURITY.md) before distributing builds.

For development, use `bun run dev`; `bun run preview` starts an isolated app with
sample accounts. Development shares `~/.nonstopvibin` with the desktop app by
default, so quit the app first or use a separate data directory as described in
[Development](docs/development.md). See [Contributing](CONTRIBUTING.md) for checks.

## Data and privacy

Data lives in `~/.nonstopvibin`, accessible through **Settings → Open data folder**.
Activity stores request metadata and token counts, not prompts or responses.
History is kept by default; optional retention deletes records older than 30, 90,
or 365 days. Usage can lose events during a crash; API value estimates are not
subscription charges.

The proxy listens on `127.0.0.1`. Profile keys cannot access management endpoints.
SQLite secrets use a local, owner-only `vault.key`; CLIProxyAPI also requires
owner-only plaintext credential files. Software running as your OS user can read
these credentials. Profiles separate account pools, not OS users. Adding the same
subscription to multiple profiles still shares its provider quota.

See [storage and reset instructions](docs/architecture.md) for details. Report
vulnerabilities through [Security](SECURITY.md), and keep credentials out of issues.

## License

[MIT](LICENSE), with [third-party notices](licenses/NOTICE.md) for bundled components.
Provider names and logos belong to their owners. NonstopVibin is not affiliated
with those providers.
