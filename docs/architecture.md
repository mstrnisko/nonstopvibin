# Storage and profile boundaries

Desktop data is under `~/Library/Application Support/nonstopvibin` on macOS and Electron's user-data directory on Linux (normally `~/.config/nonstopvibin`). Settings can reveal the directory. `NONSTOPVIBIN_DATA_DIR` and `NONSTOPVIBIN_PORT` override the data directory and default port 4318 for isolated local testing.

API keys and internal keys in SQLite are encrypted through Electron safeStorage, backed by Keychain or the Linux secret service. **The upstream process also needs plaintext credentials:** generated config and OAuth files are owner-only (0600 in 0700 directories), not encrypted while on disk. Development uses an owner-only AES-GCM key file instead of Keychain. This is separation between account pools, not an OS security boundary against software running as your user.

The gateway binds only to 127.0.0.1. Agent keys cannot access management. Host/Origin checks protect local management requests. Provider sign-in uses the external browser and a state-validated loopback callback. The renderer has no Node access and only narrowly scoped desktop IPC.

Native agent connection files contain no profile credentials. Claude Code, Codex,
and pi obtain keys through their native credential command support. They use an
owner-only local Unix socket.
The socket has no management operations and is not reachable over TCP. Native
configuration fixes the profile URL; a port change requires reconnecting, and the
credential helper refuses to return a key for a different port. Existing settings
are preserved; conflicting edits are refused. Disconnect removes owned settings,
but does not revoke cached credentials: restart the agent, or stop the profile to
stop access. Software running as your OS user remains inside the trust boundary.
Legacy launcher files from earlier builds can still use the private broker; native
setup replaces the onboarding flow without deleting those existing files.

Request bodies, API keys, generated responses, and raw upstream error bodies are not written to the activity database. Accounting is drained from the core every approximately two seconds. The database survives restarts, but a crash between upstream completion, queue collection, and SQLite commit can lose accounting events; this is not a billing ledger. Activity shows/export up to the most recent 500 records for its selected period; aggregate totals cover the period. Provider quota reads occur approximately every two minutes while profiles run, and may be delayed by slow providers. After five minutes, previous readings are visibly stale.

When migrating a refresh-token account, avoid running both apps against that same account during sign-in or token refresh. A provider may rotate the token, leaving the other copy outdated. Claude sign-in asks you to confirm the organization and destination profile before making the subscription available. Seats are distinguished by the provider's account and organization UUIDs, so the same email can connect to multiple organizations. Choose **Connect another organization** after connecting the first seat. Reconnecting the same seat preserves its connection ID, history, label, priority, and paused state; a running destination profile briefly restarts to safely replace its credential. A stopped profile stays stopped.

Matching Claude seats are rejected across profiles, including independently issued credentials with the same account and organization UUIDs. Matching top-level access/refresh tokens and API credentials are also rejected. Older Claude files lacking those UUIDs display **Organization unverified** and are never merged by email; they must be connected separately and the obsolete entry removed. Other providers and unidentified legacy credentials can still represent the same upstream account, so assign those deliberately.
