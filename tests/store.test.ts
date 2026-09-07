import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/server/store.ts";
import type { SecretCodec } from "../src/server/vault.ts";

test("saveApiAccount rolls back the account when encryption fails", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nonstopvibin-store-"));
  let rejectEncryption = false;
  const codec: SecretCodec = {
    label: "test codec",
    encrypt(value) {
      if (rejectEncryption) throw new Error("encryption failed");
      return value;
    },
    decrypt: (value) => value,
  };
  const store = new Store(directory, codec);
  try {
    const profile = store.createProfile("Fixture", "forest");
    rejectEncryption = true;
    assert.throws(
      () =>
        store.saveApiAccount(
          profile.id,
          {
            id: "fixture-account",
            name: "Fixture",
            provider: "openai",
            baseUrl: "https://example.invalid/v1",
            prefix: "",
            models: [],
            disabled: false,
          },
          "synthetic-key",
        ),
      /encryption failed/,
    );
    assert.deepEqual(store.apiAccounts(profile.id), []);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
