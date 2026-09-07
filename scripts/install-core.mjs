import { mkdir, writeFile, readFile, chmod, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import release from "./core-release.json" with { type: "json" };

const CORE_VERSION = release.version;
const platform = process.env.CORE_PLATFORM || process.platform;
const arch = process.env.CORE_ARCH || process.arch;
if (!["darwin", "linux"].includes(platform) || !["arm64", "x64"].includes(arch))
  throw new Error("Supported core platforms: macOS/Linux arm64 and x64.");
const archive = `CLIProxyAPI_${CORE_VERSION}_${platform}_${arch === "arm64" ? "aarch64" : "amd64"}.tar.gz`;
const root = resolve(".vendor/core");
await mkdir(root, { recursive: true });
const origin = `https://github.com/router-for-me/CLIProxyAPI/releases/download/v${CORE_VERSION}`;
async function download(name) {
  const response = await fetch(`${origin}/${name}`, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok)
    throw new Error(`Download ${name}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
const checksums = (await download("checksums.txt")).toString();
const expected = checksums
  .split("\n")
  .find((line) => line.trim().endsWith(archive))
  ?.split(/\s+/)[0];
if (!expected || !/^[a-f0-9]{64}$/i.test(expected))
  throw new Error("Official checksum missing.");
if (expected !== release.checksums[`${platform}_${arch}`])
  throw new Error("Official checksum differs from the reviewed release pin.");
const bytes = await download(archive);
const actual = createHash("sha256").update(bytes).digest("hex");
if (actual !== expected)
  throw new Error("Core checksum mismatch; refusing to install.");
await writeFile(join(root, archive), bytes);
const entries = execFileSync("tar", ["-tzf", join(root, archive)], {
  encoding: "utf8",
})
  .trim()
  .split("\n");
if (
  entries.some(
    (entry) => entry.startsWith("/") || entry.split("/").includes(".."),
  )
)
  throw new Error("Unsafe archive paths.");
execFileSync("tar", ["-xzf", join(root, archive), "-C", root]);
await chmod(join(root, "cli-proxy-api"), 0o755);
await mkdir("licenses", { recursive: true });
await copyFile(join(root, "LICENSE"), "licenses/CLIProxyAPI.txt");
await writeFile(
  join(root, "manifest.json"),
  JSON.stringify(
    {
      version: CORE_VERSION,
      platform,
      arch,
      archive,
      sha256: actual,
      binarySha256: createHash("sha256")
        .update(await readFile(join(root, "cli-proxy-api")))
        .digest("hex"),
    },
    null,
    2,
  ),
);
console.log(`Verified CLIProxyAPI ${CORE_VERSION} (${platform}/${arch}).`);
