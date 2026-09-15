import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { z } from "zod";

test("app and scanner dependencies use exact versions", async () => {
  for (const path of ["../package.json", "../.deepsec/package.json"]) {
    const manifest = JSON.parse(
      await readFile(new URL(path, import.meta.url), "utf8"),
    );
    for (const section of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
      "overrides",
    ]) {
      for (const [name, version] of Object.entries(manifest[section] ?? {})) {
        assert.match(
          z.string().parse(version),
          /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
          `${path}: ${section}.${name} must pin an exact version`,
        );
      }
    }
  }
});
