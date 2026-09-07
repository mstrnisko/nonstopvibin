const assert = require("node:assert/strict");
const { readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");
const { createHash } = require("node:crypto");
const { listPackage, extractFile } = require("@electron/asar");

module.exports = async function verifyPackage(context) {
  const resources =
    context.electronPlatformName === "darwin"
      ? join(
          context.appOutDir,
          `${context.packager.appInfo.productFilename}.app`,
          "Contents/Resources",
        )
      : join(context.appOutDir, "resources");
  const archive = join(resources, "app.asar");
  const entries = listPackage(archive);
  for (const entry of entries) {
    assert.match(
      entry,
      /^\/(dist(?:\/|$)|node_modules(?:\/|$)|package\.json$)/,
      `Unexpected package entry: ${entry}`,
    );
    assert.doesNotMatch(
      entry,
      /(?:^|\/)(?:\.env(?:\.[^/]*)?|\.runtime|\.test-runtime|\.deepsec|\.agents|\.git|\.codex|\.claude|\.playwright-cli|id_rsa|id_ed25519|auth\.json|credentials\.json|tokens\.json)(?:\/|$)|\.(?:pem|key|p12|pfx|sqlite3?(?:-(?:wal|shm))?|db(?:-(?:wal|shm))?|map)$/,
      `Private or development file in package: ${entry}`,
    );
  }
  for (const file of [
    "dist/desktop/main.cjs",
    "dist/desktop/preload.cjs",
    "dist/client/index.html",
  ])
    assert.ok(
      extractFile(archive, file).length,
      `Missing built entry: ${file}`,
    );
  assert.deepEqual(
    entries.filter((entry) => entry.startsWith("/dist/desktop/")),
    ["/dist/desktop/main.cjs", "/dist/desktop/preload.cjs"],
    "Stale desktop build output",
  );
  const project = context.packager.projectDir;
  for (const file of ["cli-proxy-api", "manifest.json"])
    assert.deepEqual(
      readFileSync(join(resources, "core", file)),
      readFileSync(join(project, ".vendor/core", file)),
      "Packaged core differs from the verified input",
    );
  assert.deepEqual(readdirSync(join(resources, "core")).sort(), [
    "cli-proxy-api",
    "manifest.json",
  ]);
  for (const file of readdirSync(join(project, "licenses")))
    assert.deepEqual(
      readFileSync(join(resources, "licenses", file)),
      readFileSync(join(project, "licenses", file)),
      `Missing license: ${file}`,
    );
  assert.deepEqual(
    readFileSync(join(resources, "LICENSE")),
    readFileSync(join(project, "LICENSE")),
  );
  console.log(
    `Verified package contents (${entries.length} entries, ASAR SHA-256 ${createHash("sha256").update(readFileSync(archive)).digest("hex")}).`,
  );
};
