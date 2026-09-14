import { test } from "node:test";
import assert from "node:assert/strict";
import {
  count,
  dateLabel,
  groupAccountsByProvider,
} from "../src/client/format.ts";

test("reused formatters preserve number boundaries and local date output", () => {
  for (const n of [-1, 0, 1.25, 99_999, 100_000, 1_000_000])
    assert.equal(
      count(n),
      new Intl.NumberFormat("en", {
        notation: n >= 100_000 ? "compact" : "standard",
        maximumFractionDigits: 1,
      }).format(n),
    );
  for (const locale of ["en-US", "cs-CZ"])
    for (const timeZone of ["Europe/Prague", "America/New_York"]) {
      const options = {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      } as const;
      const format = new Intl.DateTimeFormat(locale, options);
      for (const value of [
        "2026-03-29T00:30:00Z",
        "2026-03-29T01:30:00Z",
        "invalid",
      ])
        assert.equal(
          dateLabel(value, format),
          new Date(value).toLocaleTimeString(locale, options),
        );
    }
});

test("provider groups gather interleaved subscriptions without changing priority order", () => {
  const account = {
    name: "Account",
    kind: "oauth",
    disabled: false,
    status: "ready",
    priority: 0,
  } as const;
  const accounts = [
    { ...account, id: "a", provider: "claude" },
    { ...account, id: "b", provider: "codex" },
    { ...account, id: "c", provider: "claude", disabled: true },
    { ...account, id: "d", provider: "custom-provider" },
  ];
  const groups = groupAccountsByProvider(accounts);
  assert.deepEqual([...groups.keys()], ["claude", "codex", "custom-provider"]);
  assert.deepEqual(groups.get("claude"), [accounts[0], accounts[2]]);
  assert.equal([...groups.values()].flat().length, accounts.length);
  assert.deepEqual(
    accounts.map((a) => a.id),
    ["a", "b", "c", "d"],
  );
  assert.equal(groupAccountsByProvider([]).size, 0);
});
