# Contributing

## Prerequisites

Install Bun 1.4.2 and Git. On macOS, install Xcode Command Line Tools
(`xcode-select --install`) to build the native menu bar helper.

## Setup

```sh
bun run setup
```

This installs the locked dependencies and the checksum-pinned CLIProxyAPI core.

## Development

```sh
bun run dev      # Local API and Vite development server
bun run preview  # Isolated simulator with synthetic accounts
```

Run the checks that apply before opening a pull request:

```sh
bun run quality
bun test
```

Also run `bun run build` when changing runtime or build boundaries. Format touched
files with `bunx --no-install oxfmt --write <files>` before the final checks.
Documentation-only changes need formatting and a diff review.

Run the dependency and secret checks:

```sh
bun run security:deps
bun run security:install && bun run security:secrets
```

Use [the commit conventions](docs/commits.md) for commit messages, scopes, and
history cleanup.

Keep pull requests small and focused. Explain what changed, why it changed, and
which checks you ran. Include screenshots for visible UI changes.

Never put real credentials, API keys, tokens, request bodies, or provider error
responses in issues, tests, fixtures, or commits. Report vulnerabilities through
the private channel in [SECURITY.md](SECURITY.md), not a public issue.

[AGENTS.md](AGENTS.md) documents the architecture invariants and repository-specific
checks that all changes must preserve.
