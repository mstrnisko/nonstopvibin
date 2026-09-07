const { readFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { join } = require("node:path");
const { Arch } = require("electron-builder");
const release = require("./core-release.json");

module.exports = async function validateCore(context) {
  const root = join(context.packager.projectDir, ".vendor/core");
  const manifest = JSON.parse(
    readFileSync(join(root, "manifest.json"), "utf8"),
  );
  const arch = Arch[context.arch];
  if (
    manifest.version !== release.version ||
    manifest.sha256 !==
      release.checksums[`${manifest.platform}_${manifest.arch}`]
  )
    throw new Error("The proxy core does not match the reviewed release pin.");
  if (
    manifest.platform !== context.electronPlatformName ||
    manifest.arch !== arch
  )
    throw new Error(
      `The proxy core is ${manifest.platform}/${manifest.arch}, but the app target is ${context.electronPlatformName}/${arch}. Run core:install for the target first.`,
    );
  const digest = createHash("sha256")
    .update(readFileSync(join(root, "cli-proxy-api")))
    .digest("hex");
  if (digest !== manifest.binarySha256)
    throw new Error(
      "The proxy core changed after installation. Run bun run core:install again.",
    );
};
