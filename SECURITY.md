# Security and release policy

nonstopvibin handles subscription credentials and is currently a local development
application. Passing automated checks is necessary but does not certify a release.

## Supported versions

Only the latest release receives security fixes. The public API and behavior may
change without notice during the 0.x release series.

## Supported deployment

The application is a loopback desktop service on macOS/Linux, not an internet-facing
or multi-user hosted proxy. Profiles separate account pools, not OS users. Electron
safeStorage protects SQLite secrets; the upstream core still requires plaintext
OAuth/config files in owner-only directories. See [storage documentation](docs/architecture.md) for storage locations.

## Reporting

Report vulnerabilities through [GitHub private vulnerability reporting](https://github.com/samuelfarkas/nonstopvibin/security/advisories/new).
Do not put credentials, provider responses, or exploit details in public issues.
Do not include credentials or raw provider responses in a private report either.
No response-time commitment is currently offered.

## Required checks

```sh
bun ci
bun run core:install
bun run quality
bun test
bun run build
bun run security:deps
bun run security:install
bun run security:secrets
bun run security:history
```

If DeepSec is installed, also run `bun run security:tooling`. Dependency audits fail
at high severity; inspect moderate findings too. Secret scans redact output.
The directory scan excludes generated local state through `.gitleaks-source.toml`;
the history scan uses `.gitleaks.toml` and has no directory exclusions. The only
fixture exception is the exact public RFC 6455 example WebSocket nonce, constrained
to its test file and header line. Never suppress a whole test/source directory to
hide a finding. Rotate exposed credentials; adding them to .gitignore is insufficient.

Make desktop build, secret scanning, and dependency jobs required checks for
protected branches. Review dependency and action updates before merging. Workflows
use read-only repository permissions and do not receive signing or model credentials
on pull requests. Raw scanner reports are not public artifacts.

## Deep review

Use `.deepsec/README.md` for setup and bounded investigation. Review changes to
profile routing, credential import/refresh, gateway forwarding, IPC, storage, and
packaging with the threat context in `.deepsec/data/nonstopvibin/INFO.md`.
Validate findings with synthetic reproducers and regression tests before fixing or
publishing them. Review the bundled CLIProxyAPI release separately: scanning this
TypeScript wrapper does not audit the upstream Go implementation or binary.

## Distribution checklist

- Include the application MIT license and preserve third-party licenses. Audit the
  final package's notices, including native binaries and assets.
- Build from a reviewed revision with clean, frozen dependency installs. Record its
  source revision, core version and hashes, target OS/architecture, and artifact hash.
- Inspect the actual archive: include only built app code, production dependencies,
  reviewed assets/licenses, and the verified core. Exclude `.deepsec`, `.agents`,
  runtime data, environment files, signing keys, local review material, and raw scan
  reports.
- Sign and notarize the macOS release with the owner's credentials; the current
  `mac.identity: null` build is unsigned. 0.x prereleases are published unsigned and
  say so in the README and release notes. Test installation/launch/quit/reopen on a
  clean machine, and test Linux keyring behavior plus unavailable-keyring refusal.
- Run end-to-end provider verification only with deliberately assigned test accounts.
  Keep live credentials and customer/work profiles out of reusable fixtures.
- Resolve high/critical findings and document remaining limitations. Dependency and
  regex scans alone cannot establish distribution safety.

Use real signing credentials and record the checks performed on each release.
Unverified platforms and providers remain unverified.
