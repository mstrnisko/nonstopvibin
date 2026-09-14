import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import YAML from "yaml";
import pkg from "../package.json" with { type: "json" };

export function verifyReleaseTag(tag, manifest, repository) {
  assert.match(
    tag,
    /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/,
    "Use vX.Y.Z or vX.Y.Z-beta.N",
  );
  assert.equal(
    tag,
    `v${manifest.version}`,
    "Tag must match package.json version",
  );
  assert.equal(
    manifest.updatesEnabled,
    true,
    "Configure the release repository and enable updatesEnabled first",
  );
  const feed = manifest.build.publish[0];
  assert.equal(feed.provider, "github");
  assert.equal(
    `${feed.owner}/${feed.repo}`,
    repository,
    "Update feed must match the publishing repository",
  );
}

export async function verifyReleaseAssets(directory, version) {
  // electron-builder 26 uses latest manifests for GitHub, including prereleases.
  const names = await readdir(directory);
  for (const extension of ["dmg", "zip", "AppImage", "deb"])
    assert.ok(
      names.some((name) => name.endsWith(`.${extension}`)),
      `Missing ${extension} installer`,
    );
  for (const platform of ["mac", "linux"]) {
    const manifest = YAML.parse(
      await readFile(join(directory, `latest-${platform}.yml`), "utf8"),
    );
    assert.equal(manifest.version, version, "Update manifest version mismatch");
    assert.ok(
      Array.isArray(manifest.files) && manifest.files.length,
      "Missing update files",
    );
    assert.ok(
      manifest.files.some((file) =>
        file.url.endsWith(platform === "mac" ? ".zip" : ".AppImage"),
      ),
      "Missing auto-update payload",
    );
    for (const file of manifest.files) {
      assert.equal(
        file.url,
        basename(file.url),
        "Update payload must be a release asset filename",
      );
      const bytes = await readFile(join(directory, file.url));
      assert.equal(bytes.length, file.size, `Size mismatch: ${file.url}`);
      assert.equal(
        createHash("sha512").update(bytes).digest("base64"),
        file.sha512,
        `Checksum mismatch: ${file.url}`,
      );
    }
  }
}

if (import.meta.main) {
  verifyReleaseTag(process.argv[2], pkg, process.env.GITHUB_REPOSITORY);
  if (process.argv[3]) await verifyReleaseAssets(process.argv[3], pkg.version);
}
