import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import YAML from "yaml";
import {
  verifyReleaseTag,
  verifyReleaseAssets,
} from "../scripts/verify-release.mjs";

test("release tags reject disabled updates, wrong versions and wrong destinations", () => {
  const manifest = {
    version: "0.1.2",
    updatesEnabled: true,
    build: { publish: [{ provider: "github", owner: "fixture", repo: "app" }] },
  };
  verifyReleaseTag("v0.1.2", manifest, "fixture/app");
  assert.throws(
    () => verifyReleaseTag("v0.1.3", manifest, "fixture/app"),
    /version/,
  );
  assert.throws(
    () =>
      verifyReleaseTag(
        "v0.1.2",
        { ...manifest, updatesEnabled: false },
        "fixture/app",
      ),
    /enable/,
  );
  assert.throws(
    () => verifyReleaseTag("v0.1.2", manifest, "another/app"),
    /repository/,
  );
  verifyReleaseTag(
    "v0.2.0-beta.1",
    { ...manifest, version: "0.2.0-beta.1" },
    "fixture/app",
  );
});

test("release publication requires complete payloads with matching hashes and versions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nv-release-"));
  try {
    const bytes = Buffer.from("synthetic installer");
    for (const extension of ["zip", "dmg", "AppImage", "deb"])
      await writeFile(join(directory, `app.${extension}`), bytes);
    for (const platform of ["mac", "linux"])
      await writeFile(
        join(directory, `latest-${platform}.yml`),
        YAML.stringify({
          version: "0.1.2",
          files: [
            {
              url: platform === "mac" ? "app.zip" : "app.AppImage",
              size: bytes.length,
              sha512: createHash("sha512").update(bytes).digest("base64"),
            },
          ],
        }),
      );
    await verifyReleaseAssets(directory, "0.1.2");
    await assert.rejects(verifyReleaseAssets(directory, "0.1.3"), /version/);
    await writeFile(
      join(directory, "app.zip"),
      Buffer.from("corrupted installer"),
    );
    await assert.rejects(verifyReleaseAssets(directory, "0.1.2"), /mismatch/);
    await rm(join(directory, "app.AppImage"));
    await assert.rejects(
      verifyReleaseAssets(directory, "0.1.2"),
      /Missing AppImage/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
