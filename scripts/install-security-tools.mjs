import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  writeFile,
  copyFile,
  chmod,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

// Official v8.30.1 release checksums, reviewed and pinned with this script.
const version = "8.30.1";
const hashes = {
  darwin_arm64:
    "b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5",
  darwin_x64:
    "dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709",
  linux_arm64:
    "e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080",
  linux_x64: "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb",
};
const target = `${process.platform}_${process.arch}`;
if (!hashes[target])
  throw new Error(`Unsupported security tools target: ${target}`);
const archive = `gitleaks_${version}_${target}.tar.gz`;
const url = `https://github.com/gitleaks/gitleaks/releases/download/v${version}/${archive}`;
const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
if (!response.ok) throw new Error(`Gitleaks download: HTTP ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
if (createHash("sha256").update(bytes).digest("hex") !== hashes[target])
  throw new Error("Gitleaks checksum mismatch; refusing to install.");
const temp = await mkdtemp(join(tmpdir(), "nonstopvibin-gitleaks-"));
try {
  await writeFile(join(temp, archive), bytes);
  execFileSync("tar", ["-xzf", join(temp, archive), "-C", temp, "gitleaks"]);
  const destination = resolve(".vendor/security");
  await mkdir(destination, { recursive: true });
  await copyFile(join(temp, "gitleaks"), join(destination, "gitleaks"));
  await chmod(join(destination, "gitleaks"), 0o755);
  console.log(`Verified Gitleaks ${version} (${target}).`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
