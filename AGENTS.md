# Working on nonstopvibin

## Architecture and boundaries

Read README.md and SECURITY.md before changing authentication, storage, proxying,
imports, IPC, or packaging. React/Vite is the renderer; Electron owns desktop
privileges. The local server and CLIProxyAPI core own credentials and routing.
Use Bun and the checked-in bun.lock; do not reintroduce npm lockfiles. The
.deepsec workspace has its own dependencies and lockfile.

Preserve these invariants:

- Profile keys never grant management access. HTTP, SSE, WebSocket, retries,
  refreshes, accounting, and quota exhaustion must preserve the same profile.
- Bind the gateway to loopback. Keep Host/Origin checks and endpoint allowlists.
- Every privileged IPC handler validates its sender and arguments. Keep renderer
  sandboxing, context isolation, and disabled Node integration.
- Desktop storage requires safeStorage; never use plaintext fallback. The upstream
  core's required plaintext files remain owner-only and outside distribution inputs.
- Never include real auth files, API keys, request bodies, provider error bodies,
  local runtime directories, or raw security reports in commits or app bundles.
- Preserve pinned core version/checksum and packaging platform/architecture/hash
  checks. A checksum downloaded beside a binary is integrity evidence, not an
  independent guarantee that the upstream publisher was uncompromised.

## Checks

Run `bun run quality` for code/config changes and `bun test` for behavior changes.
Build with `bun run build` when changing runtime/build boundaries. Integration tests
use synthetic local providers and the verified core; do not connect real accounts
as a substitute for automated tests.

For dependencies, run `bun run security:deps`; for scanner dependency changes,
run `bun run security:tooling` too. Install Gitleaks with
`bun run security:install`, then run `bun run security:secrets`. Before releasing,
also scan Git history with `bun run security:history` and follow SECURITY.md.
Treat an audit failure or untested platform as unresolved evidence, not a pass.

## Skills

Project-local skills live in `.agents/skills/` and are versioned with the source:

- `vercel-react-best-practices`: React rendering, data flow, and performance.
  Apply the client guidance; Next.js/RSC-specific rules do not fit this Vite app.
- `vercel-composition-patterns`: reusable React component APIs and state ownership.
- `web-design-guidelines`: accessibility and UI review against Vercel guidance;
  its remote guideline body must be inspected when fetched.
- `vite`: config/plugins/builds, by Vite team member Anthony Fu. The skill is based
  on a Vite 8 beta snapshot; check current installed types/docs for exact options.
- `sharp-edges`: review misuse-prone auth/config/IPC APIs and fail-open defaults.
- `property-based-testing`: domain invariants for routing, parsers, encryption,
  and account separation. Add property tests when they constrain real behavior.

Use the existing code-review and Codex Security skills when available for diff
reviews and validated vulnerability investigations. Their availability is
machine-specific; project quality checks must not depend on those plugins.
For Electron, SQLite, Bun, TypeScript, and input validation, read the relevant
section of docs/stack-guidance.md before changing that layer. It links official
maintainer documentation; no unverified third-party skill fills these gaps.
Skill provenance, candidates, and tradeoffs are in docs/security-tooling.md.

The committed .agents/skills copies and skills-lock.json are part of project setup.
A checkout supplies them; do not reinstall or update them from latest during
`bun run setup`. Review source, references, executable files, and compatibility
before any explicit skill update. Preserve hashes and attribution. Do not add
frameworks, database adapters, or package managers merely to match a skill.

## DeepSec

Read `.deepsec/node_modules/deepsec/SKILL.md` before operating the scanner.
`bun run security:scan` is local pattern matching; it does not establish that a
candidate is exploitable. Keep curated INFO.md/config/matchers under version
control; findings, traces, reports, credentials, and generated state stay ignored.
Only create custom matchers from evidenced coverage gaps or validated findings.
AI processing can use a logged-in local coding agent or configured provider;
choose a bounded scope and review its execution environment before starting it.
Do not automatically run AI agents against untrusted PRs with repository secrets.
