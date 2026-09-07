# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Malformed sign-in callback URLs now receive a safe error response without stopping the app.

### Security

- Invalid quota responses no longer persist provider response excerpts in error text.

### Changed

- The first release exposes Claude Code, Codex, and pi as agents, and Claude, Codex, OpenCode Go, and custom API-key providers. Kimi, Antigravity, xAI, and the OpenCode agent stay in the code but are hidden from the app.
- Packaged Electron builds now disable run-as-Node and `NODE_OPTIONS` environment overrides.

## [0.1.1] - 2026-09-07

- Added separate profiles and account pools with round-robin and fill-first routing.
- Added native connections for Claude Code, Codex, and pi.
- Added quota windows and reset times in the main app and menu bar popup.
- Added activity history with observed token usage and CSV export.
- Added encrypted desktop storage through Electron safeStorage. CLIProxyAPI's
  required plaintext files remain restricted to the current OS user.
- Added macOS DMG and Linux AppImage/deb packaging. macOS builds are unsigned and
  not notarized.

[Unreleased]: https://github.com/samuelfarkas/nonstopvibin/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/samuelfarkas/nonstopvibin/releases/tag/v0.1.1
