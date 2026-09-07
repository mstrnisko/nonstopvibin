import { build } from "esbuild";
import { rm } from "node:fs/promises";

await rm("dist/desktop", { recursive: true, force: true });
await build({
  entryPoints: ["src/desktop/main.ts", "src/desktop/preload.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node24",
  outdir: "dist/desktop",
  outExtension: { ".js": ".cjs" },
  external: ["electron"],
});
