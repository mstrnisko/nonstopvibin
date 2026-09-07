import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { connect } from "node:net";
import { once } from "node:events";
import { mkdtemp, readFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { ModelCatalog } from "../src/server/model-catalog.ts";
import { Application } from "../src/server/server.ts";
import type { Json, Profile } from "../src/shared/types.ts";

let app: Application;
let company: Profile;
let personal: Profile;
let directory: string;
let failCompany = false;
const observed: string[] = [];
let upstream: http.Server;
let upstreamBase: string;
async function request(
  profile: Profile,
  body: Json = {
    model: "fixture-model",
    messages: [{ role: "user", content: "hello" }],
  },
) {
  return fetch(`${app.endpoint(profile.id)}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${app.store.secret(`${profile.id}:client`)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
}
before(
  async () => {
    directory = await mkdtemp(join(tmpdir(), "nonstopvibin-test-"));
    upstream = http.createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const key = req.headers.authorization?.replace("Bearer ", "") ?? "";
      observed.push(key);
      if (failCompany && key.startsWith("company")) {
        res.writeHead(429, {
          "Content-Type": "application/json",
          "Retry-After": "60",
        });
        res.end(
          JSON.stringify({
            error: { message: "quota exhausted", type: "rate_limit_error" },
          }),
        );
        return;
      }
      const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
      if (body.stream) {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        res.write(
          `data: ${JSON.stringify({ id: "fixture", object: "chat.completion.chunk", created: 1, model: "fixture-model", choices: [{ index: 0, delta: { role: "assistant", content: `hello from ${key}` }, finish_reason: null }] })}\n\n`,
        );
        res.end(
          `data: ${JSON.stringify({ id: "fixture", object: "chat.completion.chunk", created: 1, model: "fixture-model", choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 11, completion_tokens: 3, total_tokens: 14, prompt_tokens_details: { cached_tokens: 5 } } })}\n\ndata: [DONE]\n\n`,
        );
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            id: "fixture",
            object: "chat.completion",
            created: 1,
            model: "fixture-model",
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: `hello from ${key}` },
                finish_reason: "stop",
              },
            ],
            usage: {
              prompt_tokens: 11,
              completion_tokens: 3,
              total_tokens: 14,
              prompt_tokens_details: { cached_tokens: 5 },
            },
          }),
        );
      }
    });
    await new Promise<void>((resolve) =>
      upstream.listen(0, "127.0.0.1", resolve),
    );
    const addr = upstream.address();
    assert.ok(addr instanceof Object);
    upstreamBase = `http://127.0.0.1:${addr.port}/v1`;
    app = await Application.create({
      agentHome: join(directory, "agent-home"),
      directory,
      binary: resolve(".vendor/core/cli-proxy-api"),
      clientDirectory: resolve("dist/client"),
      port: 0,
    });
    company = app.store.createProfile("Company A", "forest");
    personal = app.store.createProfile("Personal", "blue");
    for (const [profile, keys] of [
      [company, ["company-one", "company-two"]],
      [personal, ["personal-one"]],
    ] as const)
      for (const key of keys)
        app.store.saveApiAccount(
          profile.id,
          {
            id: key,
            name: key,
            provider: "custom",
            baseUrl: upstreamBase,
            prefix: "",
            disabled: false,
            models: [{ id: "fixture-model", protocol: "openai" }],
          },
          key,
        );
    await app.core.start(company.id);
    await app.core.start(personal.id);
  },
  { timeout: 30_000 },
);
after(async () => {
  if (app) await app.close();
  if (upstream)
    await new Promise<void>((resolve) => {
      upstream.close(() => resolve());
      upstream.closeAllConnections();
    });
  if (directory) await rm(directory, { recursive: true, force: true });
});
test("real core launches with separate owner-only directories and a model catalog", async () => {
  assert.notEqual(app.core.port(company.id), app.core.port(personal.id));
  assert.ok(
    (await app.core.models(company.id)).some((m) => m.id === "fixture-model"),
  );
  for (const profile of [company, personal]) {
    const config = join(app.core.directory(profile.id), "config.yaml");
    assert.equal((await stat(config)).mode & 0o777, 0o600);
    assert.equal(
      (await stat(join(app.core.directory(profile.id), "auth"))).mode & 0o777,
      0o700,
    );
  }
  const raw = await readFile(join(directory, "nonstopvibin.sqlite"));
  assert.equal(
    raw.includes(Buffer.from(app.store.secret(`${company.id}:client`))),
    false,
  );
});
test("verified CLIProxyAPI exposes its native Codex catalog through the same profile", async () => {
  const response = await fetch(
    `${app.endpoint(company.id)}/models?client_version=0.140.0`,
    {
      headers: {
        Authorization: `Bearer ${app.store.secret(`${company.id}:client`)}`,
      },
    },
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(
    Array.isArray(body.models),
    "the core must supply Codex's models[] format",
  );
  assert.deepEqual(
    body.models.map((model: { slug: string }) => model.slug),
    ["fixture-model"],
  );
  assert.equal(body.models[0].visibility, "list");
  assert.match(body.models[0].base_instructions, /./);
});

test("management requires its own token and rejects foreign origins/hosts", async () => {
  assert.equal((await fetch(`${app.origin}/api/state`)).status, 401);
  assert.equal(
    (
      await fetch(`${app.origin}/api/state`, {
        headers: {
          Authorization: `Bearer ${app.token}`,
          Origin: "https://evil.example",
        },
      })
    ).status,
    403,
  );
  // Node fetch owns the Host header; use raw HTTP to actually put a foreign Host on the wire.
  const foreignHostStatus = await new Promise<number | undefined>(
    (resolve, reject) => {
      const request = http.get(
        `${app.origin}/api/state`,
        {
          headers: {
            Authorization: `Bearer ${app.token}`,
            Host: "evil.example",
          },
        },
        (response) => {
          response.resume();
          resolve(response.statusCode);
        },
      );
      request.once("error", reject);
    },
  );
  assert.equal(foreignHostStatus, 403);
  assert.equal(
    (
      await fetch(`${app.origin}/api/state`, {
        headers: { Authorization: `Bearer ${app.token}` },
      })
    ).status,
    200,
  );
});
test("agent setup remains management-only and checks the complete profile through the gateway", async () => {
  const path = `${app.origin}/api/profiles/${company.id}/agent-setup`;
  const input = {
    agent: "codex",
  };
  const headers = {
    Authorization: `Bearer ${app.token}`,
    "Content-Type": "application/json",
  };
  const denied = await fetch(path, {
    method: "POST",
    headers: {
      ...headers,
      Authorization: `Bearer ${app.store.secret(`${company.id}:client`)}`,
    },
    body: JSON.stringify(input),
  });
  assert.equal(denied.status, 401);
  const foreign = await fetch(path, {
    method: "POST",
    headers: { ...headers, Origin: "https://evil.example" },
    body: JSON.stringify(input),
  });
  assert.equal(foreign.status, 403);
  const invalid = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...input, model: "not-in-this-profile" }),
  });
  assert.equal(invalid.status, 400);
  const escaped = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...input, directory: "/tmp/unapproved" }),
  });
  assert.equal(escaped.status, 400);
  const created = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  assert.equal(created.status, 200);
  const setup = await created.json();
  assert.equal(
    JSON.stringify(setup).includes(app.store.secret(`${company.id}:client`)),
    false,
  );
  assert.deepEqual(setup.models, ["fixture-model"]);
  const other = await fetch(
    `${app.origin}/api/profiles/${personal.id}/agent-setup?agent=pi`,
    { headers },
  );
  assert.equal(await other.json(), null);
  const before = observed.length;
  const checked = await fetch(
    `${app.origin}/api/profiles/${company.id}/agent-check`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    },
  );
  assert.equal(checked.status, 200);
  assert.deepEqual(await checked.json(), { ok: true });
  assert.equal(
    observed.length,
    before,
    "catalog check must not send an upstream inference request",
  );
  const removed = await fetch(path, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ agent: "codex" }),
  });
  assert.equal(removed.status, 200);
  for (const file of setup.files)
    await assert.rejects(stat(file), { code: "ENOENT" });
});
test("dynamic agent discovery uses validated metadata and the authenticated live profile catalog", async () => {
  const original = app.gateway.catalog;
  const catalog = new ModelCatalog(
    Object.assign(
      async () =>
        Response.json({
          custom: {
            models: {
              "fixture-model": {
                name: "Synthetic",
                modalities: { input: ["text"], output: ["text"] },
                reasoning: false,
                tool_call: true,
                limit: { context: 64000, output: 8000 },
                cost: {
                  input: 1.25,
                  output: 5,
                  cache_read: 0.125,
                  cache_write: 1.5,
                },
              },
              "public-only": { name: "Must not appear" },
            },
          },
        }),
      fetch,
    ),
  );
  Object.defineProperty(app.gateway, "catalog", {
    value: catalog,
    configurable: true,
  });
  try {
    for (const agent of ["pi", "opencode"]) {
      const endpoint = `${app.endpoint(company.id)}/models?nonstopvibin=${agent}`;
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${app.store.secret(`${company.id}:client`)}`,
        },
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.deepEqual(
        body.models.map((m: { id: string }) => m.id),
        ["fixture-model"],
      );
      assert.equal(body.models[0].cost.input, 1.25);
      assert.equal(
        agent === "pi"
          ? body.models[0].contextWindow
          : body.models[0].limit.context,
        64000,
      );
      assert.equal(
        (
          await fetch(endpoint, {
            headers: {
              Authorization: `Bearer ${app.store.secret(`${personal.id}:client`)}`,
            },
          })
        ).status,
        403,
      );
      const setup = await fetch(
        `${app.origin}/api/profiles/${company.id}/agent-setup`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${app.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ agent }),
        },
      );
      assert.equal(setup.status, 200);
      assert.deepEqual((await setup.json()).models, ["fixture-model"]);
      const remove = await fetch(
        `${app.origin}/api/profiles/${company.id}/agent-setup`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${app.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ agent }),
        },
      );
      assert.equal(remove.status, 200);
    }
  } finally {
    Object.defineProperty(app.gateway, "catalog", {
      value: original,
      configurable: true,
    });
  }
});

test("missing, wrong and mismatched profile credentials never reach upstream", async () => {
  const before = observed.length;
  assert.equal((await fetch(`${app.endpoint(company.id)}/models`)).status, 401);
  assert.equal(
    (
      await fetch(`${app.endpoint(company.id)}/models`, {
        headers: { Authorization: "Bearer wrong" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(`${app.endpoint(company.id)}/models`, {
        headers: {
          Authorization: `Bearer ${app.store.secret(`${personal.id}:client`)}`,
        },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(`${app.origin}/p/${company.slug}/v0/management/config`, {
        headers: {
          Authorization: `Bearer ${app.store.secret(`${company.id}:client`)}`,
        },
      })
    ).status,
    404,
  );
  assert.equal(observed.length, before);
});
test("round robin with session affinity off uses both company credentials and never personal credentials", async () => {
  const changed = await fetch(`${app.origin}/api/profiles/${company.id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${app.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sessionAffinity: false }),
  });
  assert.equal(changed.status, 200, await changed.text());
  const before = observed.length;
  for (let i = 0; i < 6; i++) {
    const response = await request(company);
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(response.headers.get("x-nonstopvibin-profile"), "company-a");
    await response.text();
  }
  const selected = observed.slice(before);
  assert.equal(selected.filter((k) => k === "company-one").length, 3);
  assert.equal(selected.filter((k) => k === "company-two").length, 3);
});
test("the shared /v1 endpoint routes solely by profile API key", async () => {
  const response = await fetch(`${app.origin}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${app.store.secret(`${personal.id}:client`)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "fixture-model",
      messages: [{ role: "user", content: "hello" }],
    }),
  });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /personal-one/);
});
test("SSE survives the real core and gateway with usage events and completion marker", async () => {
  const response = await request(company, {
    model: "fixture-model",
    messages: [{ role: "user", content: "hello" }],
    stream: true,
    stream_options: { include_usage: true },
  });
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /text\/event-stream/,
  );
  const text = await response.text();
  assert.match(text, /hello from company/);
  assert.match(text, /\[DONE\]/);
});
test("actual upstream accounting reaches durable SQLite exactly once", async () => {
  for (let attempt = 0; attempt < 30; attempt++) {
    await app.core.collectUsage(company.id);
    if (app.store.summary(company.id).requests >= 7) break;
    await delay(50);
  }
  const summary = app.store.summary(company.id);
  assert.equal(summary.requests, 7);
  assert.equal(summary.totalTokens, 98);
  assert.equal(summary.outputTokens, 21);
  const raw = JSON.stringify(app.store.usage(company.id));
  assert.equal(raw.includes("company-one"), false);
  assert.equal(raw.includes("hello"), false);
  await app.core.collectUsage(company.id);
  assert.deepEqual(app.store.summary(company.id), summary);
});
test("fill first stays on one eligible credential", async () => {
  const changed = await fetch(`${app.origin}/api/profiles/${company.id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${app.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ strategy: "fill-first", sessionAffinity: true }),
  });
  assert.equal(changed.status, 200, await changed.text());
  const before = observed.length;
  for (let i = 0; i < 4; i++) {
    const r = await request(company);
    assert.equal(r.status, 200);
    await r.text();
  }
  assert.equal(new Set(observed.slice(before)).size, 1);
});
test("Anthropic Messages and OpenAI Responses are translated through the profile core", async () => {
  for (const [path, payload] of [
    [
      "messages",
      {
        model: "fixture-model",
        max_tokens: 20,
        messages: [{ role: "user", content: "hello" }],
      },
    ],
    ["responses", { model: "fixture-model", input: "hello", stream: false }],
  ] as const) {
    const response = await fetch(`${app.endpoint(personal.id)}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${app.store.secret(`${personal.id}:client`)}`,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
    assert.equal(response.status, 200, await response.clone().text());
    assert.match(await response.text(), /hello from personal-one/);
  }
});
test("OAuth sessions are profile bound, cancellable, and protected from concurrent starts", async () => {
  const results = await Promise.allSettled([
    app.core.beginOAuth(company.id, "codex"),
    app.core.beginOAuth(personal.id, "codex"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const session = results.find((r) => r.status === "fulfilled");
  assert.ok(session?.status === "fulfilled");
  const signInUrl = new URL(session.value.url);
  assert.equal(signInUrl.hostname, "auth.openai.com");
  const redirect = signInUrl.searchParams.get("redirect_uri");
  assert.ok(redirect);
  const callback = new URL(redirect);
  const malformedResponse = await new Promise<string>((resolve, reject) => {
    const socket = connect(Number(callback.port), "127.0.0.1");
    socket.once("error", reject);
    socket.once("connect", () =>
      socket.write("GET //[ HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n"),
    );
    socket.once("data", (chunk) => {
      socket.destroy();
      resolve(chunk.toString());
    });
  });
  assert.match(malformedResponse, /^HTTP\/1\.1 400/);
  await app.core.oauthStatus(session.value.profileId, session.value.state);
  const wrongProfile =
    session.value.profileId === company.id ? personal.id : company.id;
  await assert.rejects(
    app.core.oauthStatus(wrongProfile, session.value.state),
    /not found for this profile/,
  );
  await assert.rejects(
    app.core.cancelOAuth(wrongProfile, session.value.state),
    /not found for this profile/,
  );
  await app.core.cancelOAuth(session.value.profileId, session.value.state);
  assert.equal(app.core.oauth, undefined);
  const next = await app.core.beginOAuth(personal.id, "codex");
  await app.core.cancelOAuth(personal.id, next.state);
});
test("quota exhaustion fails inside Company A while Personal remains available", async () => {
  failCompany = true;
  const before = observed.length;
  const response = await request(company);
  assert.equal(response.status, 429);
  await response.text();
  assert.ok(observed.slice(before).every((k) => k.startsWith("company")));
  const other = await request(personal);
  assert.equal(other.status, 200);
  assert.match(await other.text(), /personal-one/);
});
test("stopping a profile fails closed and a restart preserves its key and usage", async () => {
  const key = app.store.secret(`${personal.id}:client`);
  await app.core.collectUsage(personal.id);
  const summary = app.store.summary(personal.id);
  await app.core.stop(personal.id);
  assert.equal((await request(personal)).status, 503);
  await app.core.start(personal.id);
  assert.equal(app.store.secret(`${personal.id}:client`), key);
  assert.deepEqual(app.store.summary(personal.id), summary);
  const result = await request(personal);
  assert.equal(result.status, 200);
  await result.text();
});

test("Responses WebSocket upgrades enforce the same profile boundary", async () => {
  async function handshake(profile: Profile, key: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const req = http.get(`${app.endpoint(profile.id)}/responses`, {
        headers: {
          Authorization: `Bearer ${key}`,
          Connection: "Upgrade",
          Upgrade: "websocket",
          "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
          "Sec-WebSocket-Version": "13",
        },
      });
      req.once("upgrade", (response, socket) => {
        socket.destroy();
        resolve(response.statusCode!);
      });
      req.once("response", (response) => {
        response.resume();
        resolve(response.statusCode!);
      });
      req.once("error", (error) =>
        reject(
          new Error(
            `Handshake for ${profile.slug} with ${key === app.store.secret(`${profile.id}:client`) ? "matching" : "foreign"} key: ${error.message}`,
            { cause: error },
          ),
        ),
      );
      req.setTimeout(5000, () =>
        req.destroy(new Error("WebSocket handshake timed out")),
      );
    });
  }
  assert.equal(
    await handshake(personal, app.store.secret(`${company.id}:client`)),
    403,
  );
  assert.equal(
    await handshake(personal, app.store.secret(`${personal.id}:client`)),
    101,
  );
});

test("account pause, resume and removal apply to the running model catalog", async () => {
  await app.core.setAccount(personal.id, "personal-one", { disabled: true });
  assert.equal(
    (await app.core.models(personal.id)).some((m) => m.id === "fixture-model"),
    false,
  );
  await app.core.setAccount(personal.id, "personal-one", { disabled: false });
  assert.equal(
    (await app.core.models(personal.id)).some((m) => m.id === "fixture-model"),
    true,
  );
  await app.core.removeAccount(personal.id, "personal-one");
  assert.equal(app.core.accounts(personal.id).length, 0);
  assert.equal(
    (await app.core.models(personal.id)).some((m) => m.id === "fixture-model"),
    false,
  );
  assert.throws(
    () => app.store.secret("personal-one:api"),
    /Credential not found/,
  );
});

test(
  "stop completes when the core exits during the final usage drain",
  { timeout: 2000 },
  async () => {
    const runtime = app.core.runtimes.get(personal.id);
    assert.ok(runtime);
    const collectUsage = app.core.collectUsage;
    app.core.collectUsage = async (profileId) => {
      await collectUsage.call(app.core, profileId);
      const exited = once(runtime.child, "exit");
      runtime.child.kill("SIGTERM");
      await exited;
    };
    try {
      await app.core.stop(personal.id);
      assert.equal(runtime.state, "stopped");
      assert.equal(app.store.profile(personal.id).enabled, false);
    } finally {
      app.core.collectUsage = collectUsage;
    }
  },
);
