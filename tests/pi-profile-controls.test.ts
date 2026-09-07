import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { piProfileControls } from "../src/server/pi-profile-controls.ts";

test("pi profile controls preserve session routing across selection, restore, failures and concurrent sessions", async () => {
  const fixture = await readFile(
    new URL("./fixtures/pi-profile-controls.mjs", import.meta.url),
    "utf8",
  );
  const result: Promise<void> = runInNewContext(
    `${piProfileControls}\nconst verify = ${fixture}\nverify(assert, connectProfileControls)`,
    { assert },
  );
  await result;
});
