import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createPackage, uncacheAll } from "@electron/asar";
import { Arch } from "electron-builder";
import validateCore from "../scripts/validate-core.cjs";
import verifyPackage from "../scripts/verify-package.cjs";
import release from "../scripts/core-release.json" with { type: "json" };

const project = resolve(import.meta.dirname, "..");

test("Git ignores private state while retaining source, skill copies and lockfiles", async () => {
  const root = await mkdtemp(join(tmpdir(), "nv-ignore-"));
  try {
    await cp(join(project, ".gitignore"), join(root, ".gitignore"));
    await mkdir(join(root, ".deepsec"));
    await cp(
      join(project, ".deepsec/.gitignore"),
      join(root, ".deepsec/.gitignore"),
    );
    execFileSync("git", ["init", "--quiet", root]);
    const ignored = [
      ".runtime/auth/account.json",
      ".test-runtime/demo/key",
      ".playwright-cli/page.yml",
      ".codex/state.json",
      ".env",
      ".env.production",
      "credentials.json",
      "accounts/auth.json",
      "id_ed25519",
      "data.sqlite-wal",
      "report.sarif",
      "release/app.dmg",
      "artifacts/scan.json",
      ".deepsec/data/app/files/source.json",
      ".deepsec/data/app/runs/run.json",
      ".deepsec/data/app/project.json",
    ];
    const kept = [
      "src/main.tsx",
      "bun.lock",
      "scripts/core-release.json",
      ".env.example",
      ".deepsec/.env.example",
      ".deepsec/bun.lock",
      ".deepsec/data/app/INFO.md",
      ".deepsec/data/app/config.json",
      ".agents/skills/vite/SKILL.md",
      "docs/screenshots/subscriptions.png",
    ];
    const actual = execFileSync(
      "git",
      ["-C", root, "check-ignore", "--no-index", "--stdin"],
      { input: [...ignored, ...kept].join("\n") + "\n", encoding: "utf8" },
    )
      .trim()
      .split("\n");
    assert.deepEqual(actual, ignored);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("packaging rejects an unreviewed core, wrong target and altered binary", async () => {
  const root = await mkdtemp(join(tmpdir(), "nv-core-package-"));
  try {
    const core = join(root, ".vendor/core");
    await mkdir(core, { recursive: true });
    const bytes = Buffer.from("synthetic core");
    await writeFile(join(core, "cli-proxy-api"), bytes);
    const manifest = {
      version: release.version,
      platform: "darwin",
      arch: "arm64",
      sha256: release.checksums.darwin_arm64,
      binarySha256: createHash("sha256").update(bytes).digest("hex"),
    };
    const save = (value) =>
      writeFile(join(core, "manifest.json"), JSON.stringify(value));
    const context = {
      packager: { projectDir: root },
      arch: Arch.arm64,
      electronPlatformName: "darwin",
    };
    await save(manifest);
    await validateCore(context);
    await assert.rejects(
      validateCore({ ...context, electronPlatformName: "linux" }),
      /target/,
    );
    await assert.rejects(
      validateCore({ ...context, arch: Arch.x64 }),
      /target/,
    );
    await save({ ...manifest, version: "0.0.0" });
    await assert.rejects(validateCore(context), /reviewed release/);
    await save({ ...manifest, sha256: "0".repeat(64) });
    await assert.rejects(validateCore(context), /reviewed release/);
    await save(manifest);
    await writeFile(join(core, "cli-proxy-api"), "tampered");
    await assert.rejects(validateCore(context), /changed after installation/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the packaged archive check catches source, secrets and stale output", async () => {
  const root = await mkdtemp(join(tmpdir(), "nv-archive-"));
  try {
    const source = join(root, "app");
    const resources = join(root, "out/resources");
    for (const file of [
      "dist/client/index.html",
      "dist/desktop/main.cjs",
      "dist/desktop/preload.cjs",
      "package.json",
    ]) {
      await mkdir(join(source, file, ".."), { recursive: true });
      await writeFile(join(source, file), "synthetic");
    }
    for (const dir of [
      ".vendor/core",
      "licenses",
      "out/resources/core",
      "out/resources/licenses",
    ])
      await mkdir(join(root, dir), { recursive: true });
    for (const file of ["cli-proxy-api", "manifest.json"]) {
      await writeFile(join(root, ".vendor/core", file), "synthetic");
      await writeFile(join(resources, "core", file), "synthetic");
    }
    const license = await readFile(join(project, "LICENSE"));
    await writeFile(join(root, "LICENSE"), license);
    await writeFile(join(resources, "LICENSE"), license);
    const context = {
      appOutDir: join(root, "out"),
      electronPlatformName: "linux",
      packager: { projectDir: root },
    };
    const pack = async () => {
      uncacheAll();
      await createPackage(source, join(resources, "app.asar"));
    };
    await pack();
    await verifyPackage(context);
    for (const file of [
      "README.md",
      "dist/client/auth.json",
      "dist/client/state.sqlite-wal",
      "dist/client/id_ed25519",
      "dist/desktop/obsolete.cjs",
    ]) {
      await writeFile(join(source, file), "must not ship");
      await pack();
      await assert.rejects(verifyPackage(context));
      await rm(join(source, file));
    }
  } finally {
    uncacheAll();
    await rm(root, { recursive: true, force: true });
  }
});
