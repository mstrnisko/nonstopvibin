# Development

For client prerequisites, model catalogs, removal, and troubleshooting, see
[Quick agent setup](agent-setup.md).

Requires Git and [Bun 1.4.2](https://bun.com/docs/installation), pinned in `package.json` for CI. Bun 1.3.14 cannot run this app's `node:sqlite` API. Electron provides the installed desktop app's runtime. Install on the OS/architecture you are targeting:

```sh
bun run setup       # Locked dependencies + checksum-verified proxy core
bun run dev         # API + Vite; open the session URL printed in the terminal
```

The development database is `.runtime`; it is separate from the desktop app. Bun loads local `.env` files automatically. Vite updates the renderer as you edit; restart `bun run dev` after server changes. Ctrl+C stops both development processes. For a clearly labeled simulation with no real subscription credentials, run `bun run preview`, then open its printed URL.

```sh
bun run quality     # TypeScript + Oxlint + Oxfmt checks (also run in CI)
bun run format      # Format source, tests, scripts, and project configuration
bun test            # Add --watch to rerun while editing
bun run build
bun run start       # Launch the built Electron app
bun run dist:mac     # DMG, on macOS
bun run dist:linux   # AppImage and deb, on Linux
```

Use `bun ci` to restore the exact dependency versions, `bun add <package>` to add one, and `bun update` for intentional updates. Commit `bun.lock` with `package.json`. CI reads the Bun version from `packageManager` and uses a frozen install. No global Vite, TypeScript, or Electron CLI is needed.

Linting uses [Oxlint](https://oxc.rs/docs/guide/usage/linter), including the migrated
JavaScript/TypeScript rules and React Hooks checks, with zero warnings allowed.
[Oxfmt](https://oxc.rs/docs/guide/usage/formatter) preserves the existing 80-column
style without sorting imports or package keys. Configuration lives in
`.oxlintrc.json` and `.oxfmtrc.json`; generated files, local runtime data, vendored
skills, and the separate `.deepsec` workspace are excluded. VS Code and Cursor
recommend the official Oxc extension; install it to use the included format-on-save
settings. `bun run check` checks TypeScript alone; `bun run format:check` checks formatting.

The [anti-slop](https://github.com/dmmulroy/anti-slop) Oxlint plugin (v0.1.2, commit
`e8c4880`, MIT) is vendored under `tools/oxlint/anti-slop/` and loaded through
`@oxlint/plugins`. All fifteen rules run as errors on TypeScript sources; the
vendored copy is kept byte-identical to upstream and excluded from linting and
formatting. `src/server/json.ts` holds the shared `Json` boundary accessors the
rules steer toward instead of `unknown`, `typeof`, and casts.

Linux needs a desktop secret service such as GNOME Keyring or KWallet. The app refuses Electron's plaintext fallback. GNOME may require an AppIndicator extension to show a tray icon; the View menu's quota command remains available. A native linux/arm64 AppImage smoke test in an Ubuntu 24.04 container failed during extraction because `libz.so` was unavailable, so the app did not start; a real desktop Linux session with a keyring is still untested. CI builds and tests on Linux and macOS.

The core installer pins 7.2.151 and all four supported archive checksums in
`scripts/core-release.json`, then checks the downloaded release against those pins. Packaging also checks the core platform, architecture, and binary hash, preventing a Mac core from accidentally being included in a Linux build. No automatic upstream update runs. Change the pinned version and reviewed hashes together, reinstall it, and run the tests before packaging.

## Contributor guidance

The project includes reviewed skills in `.agents/skills`; no global installation is
required. Read [AGENTS.md](../AGENTS.md) for task routing and
[stack guidance](stack-guidance.md) for Electron, SQLite, Bun, TypeScript,
React, and Vite. `bun run setup` uses the checked-in copies without downloading
latest skill content. Sources, exact reviewed revisions, and the update policy are
recorded in [security tooling](security-tooling.md).

## Package metadata

Debian packaging uses the project homepage in `package.json`. The AppImage target
alone can be built with `bun run build` followed by
`bun run electron-builder --linux AppImage --publish never` on Linux.

## Package checks

Packaging runs `scripts/validate-core.cjs` before building the archive and
`scripts/verify-package.cjs` afterwards. These reject the wrong core version,
target or hash, unexpected application files, credential files, stale desktop
output, and missing licenses. Distribution commands use `--publish never`; they
only create local artifacts. Packaged builds disable `ELECTRON_RUN_AS_NODE` and
`NODE_OPTIONS`; ASAR integrity fuses remain disabled because unsigned builds failed
to launch with them. Follow the [macOS release signing guide](release-signing.md)
for package checks, then see [SECURITY.md](../SECURITY.md) for release requirements.

Run `bun run security:install`, `bun run security:secrets`,
`bun run security:history`, and `bun run security:deps` before sharing source.
The optional scanner workspace has its own locked dependencies and
`bun run security:tooling` audit.

`bun run icons` regenerates the app and tray assets from the SVG sources.
`scripts/check-pi-profiles.mjs` is an optional compatibility check against an
installed pi package; pass that package's directory as its argument.
