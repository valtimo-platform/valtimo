<!--
  Copyright 2015-2026 Ritense BV, the Netherlands.
  Licensed under EUPL, Version 1.2 (the "License");
  https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
-->

# Testing the Plugin Host & SDK

This guide explains how the two TypeScript packages here are tested:

- **`plugin-host/app`** — the *host*: the small Node.js service that stores plugins and runs them.
- **`plugin-host/plugin-sdk`** — the *SDK*: the library and build tools plugin authors use.

More important than *how* we test is **what kind of test to write when you change something**. The
idea is simple: pick the lightest kind of test that can still catch the mistake you might make. A
plain function is cheap to test on its own; a database query is not, so only reach for the heavy,
slow tests when a light one genuinely can't cover the risk.

> This file is the canonical guide to how the plugin host & SDK are tested.

## A quick tour of the five kinds of test

We group tests into five layers, from lightest to heaviest. "Lighter" means faster and with fewer
things that need to be installed or running.

| Layer | In one sentence | Needs |
|-------|-----------------|-------|
| **L1 — Unit** | Call one function on its own and check what it returns. | nothing extra |
| **L2 — Component** | Send a fake HTTP request into a route and check the response. | nothing extra |
| **L3 — Wasm** | Build a real plugin and actually run it in the sandbox. | Node ≥ 22, the `extism-js` compiler |
| **L4 — Integration** | Run the code against a real database and message broker. | Docker |
| **L5 — Contract** | Prove our code agrees with the Java/Kotlin backend, byte for byte. | nothing extra |

All tests use **Vitest** (a test runner, like Jest). The everyday command is `npm test`, which runs
only the fast layers (L1, L2, L5) — so it needs nothing installed beyond the npm packages and runs
anywhere. The two heavy layers (L3, L4) are separate commands you run on purpose, and they each get
their own job in CI.

```bash
# plugin-sdk/
npm test                 # L1 (+ the browser-side SDK, see "happy-dom" below)

# app/
npm test                 # L1 + L2 + L5  — fast, no Docker, no extra tools
npm run test:cov         # the same, plus a coverage report
npm run test:wasm        # L3 — needs Node 22 and the extism-js compiler
npm run test:int         # L4 — needs Docker running
```

## What you need installed

- **Node.js** — `npm test` runs on any supported version. **L3 (`npm run test:wasm`) needs Node 22
  or newer.** That is because running a plugin uses a background worker thread that older Node
  versions can't start. (The part of L3 that needs Node 22 skips itself automatically on older
  versions, so nothing breaks — those tests just don't run.)
- **`extism-js`** — only for L3. This is the compiler that turns a plugin's TypeScript into a
  WebAssembly (`.wasm`) file. We don't commit it to the repo (it's a large binary). Download it from
  https://github.com/extism/js-pdk/releases and drop it at `plugin-host/.bin/extism-js`; the test
  setup looks for it there. On macOS the OS blocks freshly-downloaded binaries once — clear that with
  `xattr -d com.apple.quarantine plugin-host/.bin/extism-js`. CI downloads it automatically.
- **Docker** — only for L4. The tests start throwaway Postgres and RabbitMQ containers themselves and
  shut them down afterwards, so you just need Docker running; no manual setup.

## The layers in detail

### L1 — Unit: test one function on its own

The default and by far the most common. You import a single function, call it with some input, and
check the output. Anything it would normally talk to (the network, a database, the file system) is
replaced with a **stub** — a stand-in fake you control, so the test stays fast and predictable.

Example — the signing function is called directly, no server involved:

```ts
expect(verifyHmac(secret, "POST", path, signature, timestamp, body).valid).toBe(true);
```

Where you'll find these: `security/hmac.test.ts`, `host-functions/gzac-api.test.ts` (with a fake
plugin call-context and a stubbed `fetch`), `rabbitmq/event-consumer.test.ts` (with a fake message
library), `models/app-config.test.ts`, `https-options.test.ts`, and in the SDK
`manifest-validation.test.ts` and `frontend/plugin-frontend-sdk.test.ts`.

> **"happy-dom".** The browser-side SDK code expects browser globals like `window`. Node doesn't have
> those, so that one test file runs in **happy-dom**, a lightweight fake browser. It's switched on per
> file with a one-line comment at the top (`// @vitest-environment happy-dom`).

### L2 — Component: send a fake request into a route

L1 and L2 look similar (same runner, same folder, both fast) — the difference is *what* they test.
L1 checks a single function. **L2 checks a whole HTTP route the way a real caller would hit it**, but
without opening a real network port. Vitest's `inject()` feeds a made-up request through the *actual*
web framework (Fastify) — routing, authentication checks, body parsing, the handler, the response —
and hands back the status code and body to check.

This catches wiring mistakes a unit test can't: a wrong status code, an authentication check that
was forgotten on a route, a missing CORS header, and so on.

```ts
import { buildTestApp, signHeaders, testConfig } from "../test-support/harness";

const app = await buildTestApp((a) => hostConfigurationRoutes(a, { /* fake dependencies */ }));
const res = await app.inject({
  method: "POST",
  url: "/api/host/configurations/cfg-1",
  headers: { "content-type": "application/json", ...signHeaders("POST", path, payload) },
  payload,
});
expect(res.statusCode).toBe(201);
```

- `buildTestApp` sets up the web app exactly like production (same request-body handling, same file
  upload handling), then lets you register just the route you're testing.
- `signHeaders` produces a valid request signature (see **HMAC** below) using a *different*
  implementation than the one being tested — so the test proves the route really accepts a properly
  signed request, not just that the code agrees with itself.
- The route's helpers (plugin manager, config store, etc.) are still fakes; only the web framework is
  real.

> **HMAC, in plain terms.** Every request from the backend to the host carries a signature. The
> signature is made by mixing the request (method, path, timestamp, body) with a shared secret both
> sides know. The host recomputes it and compares. If they match, the request genuinely came from the
> backend and wasn't altered in transit. If the body is changed or the secret is wrong, the signature
> won't match and the host rejects it (HTTP 401).

### L3 — Wasm: build a real plugin and run it

This is the only layer that compiles a real plugin and executes it. "Wasm" is **WebAssembly** — the
sandboxed format plugins are compiled to; **Extism** is the runtime that loads and runs them safely.

We need this layer because two things simply cannot be reproduced by faking them in Node — they only
happen for real inside the WebAssembly sandbox:

- How the SDK settles a plugin's `async`/`await` code (the sandbox uses a tiny JavaScript engine,
  QuickJS, that behaves differently from Node here — see the note at the end of this file).
- How the host safely runs one plugin call at a time (the sandbox refuses to be called twice at once,
  and the host has a lock to prevent that).

The tests use a small, purpose-built **fixture plugin** at `test-fixtures/test-plugin/`. (A *fixture*
is a fixed, reusable piece of test setup — here, a tiny real plugin with predictable handlers like
`echo`, `boom`, and an event handler.) A setup step compiles it to `.wasm` automatically before the
tests run, so to add a case you just add a handler to the fixture.

```bash
# from plugin-host/app, with Node 22 active and extism-js in ../.bin
npm run test:wasm
```

### L4 — Integration: test against a real database and broker

Here we run the real code against a **real Postgres database and a real RabbitMQ message broker** —
not fakes. Starting real services is slow, so we only use this for things where the fake wouldn't be
trustworthy: the actual SQL and JSON storage, and the live behaviour of message delivery (including
recovering after the broker connection drops).

This is powered by **Testcontainers**, a library that starts a throwaway service in a Docker
container just for the test and removes it afterwards:

```ts
const pg = await new PostgreSqlContainer("postgres:16-alpine").start();
const rabbit = await new RabbitMQContainer("rabbitmq:3.13-management-alpine").start();
```

Keep each test independent (its own message exchange, a cleared table between tests) and wait for
things to arrive with a poll-until-true helper rather than a fixed sleep, so the tests aren't flaky.

### L5 — Contract: prove we match the backend

Some of our code has to agree *exactly* with the Java/Kotlin backend — for example, both sides must
compute the same request signature, or a plugin accepted by one side must be accepted by the other.
If the two drift apart, plugins break in ways that are hard to trace.

We lock this down with **golden vectors**.

> **What's a "golden vector"?** It's a saved example of a known-correct answer: a fixed input paired
> with the exact output it should produce. We compute the outputs *once*, using a neutral third-party
> tool (not our own code), and save them to a file. The test then feeds each input through our code
> and checks it reproduces the saved output. Because the saved answer came from an independent tool
> (an **oracle** — a trusted source of the right answer, here the `openssl` command), the test can't
> "cheat" by agreeing with a bug in our own implementation. And because the backend is verified
> against the *same* saved answers, both sides are pinned to one shared source of truth.

Concretely:

- **Signatures:** `test-fixtures/hmac-vectors.json` holds inputs and their correct signatures,
  generated with `openssl`. `security/hmac.test.ts` checks our signing reproduces them; the backend
  is checked against the same construction.
- **Plugin manifest rules:** `manifest-validation.test.ts` locks in the single set of validation
  rules that both the plugin build tool and the host's upload endpoint share, so they can't disagree
  about what a valid plugin looks like.

## Shared helpers & fixtures

| Path | What it's for |
|------|---------------|
| `app/src/test-support/harness.ts` | Helpers for L2 route tests: build a test app, sign a request, make a config. |
| `test-fixtures/hmac-vectors.json` | The saved signature examples for the L5 contract tests. |
| `test-fixtures/test-plugin/` | The small real plugin compiled and run by the L3 tests. |
| `app/test/wasm/` | The L3 setup that compiles the fixture plugin before the tests. |

## Conventions

- Put the **licence header** on every source and test file.
- Put L1/L2 tests **next to the code** they test, named `*.test.ts`. Keep the heavier L3/L4 tests in
  `app/test/wasm/` and `app/test/integration/` (named `*.wasm.test.ts` and `*.int.test.ts`) so the
  everyday `npm test` never picks them up.
- For anything security-related, generate the expected value with an **independent tool**, never with
  the code you're testing.
- When the code does something not-quite-ideal but intentional, **write a passing test that documents
  the real behaviour, with a comment explaining it** — that's clearer than no test, and it will start
  failing (as a helpful reminder) if someone later changes the behaviour. See "Known behaviours" below.
- Always clean up after a test (close the app, stop the container, delete temp files) so tests don't
  interfere with each other.

## What to write when — a cheat sheet

| If you change… | Write / update… | Layer |
|----------------|-----------------|-------|
| The request-signature code | golden-vector checks + rejection cases; keep in step with the backend | L5 + L1 |
| A web route or an auth check | a route test: the success case, every rejection, and an unsigned request → 401 | L2 |
| Anything about auth, tokens, or permissions | the failure cases (missing / forged / tampered / expired), and confirm the default is "deny" | L1/L2 |
| The plugin-manifest rules | validation cases; make sure the build tool and the upload endpoint still agree | L1/L5 |
| How the SDK runs a plugin's handlers | a fixture handler + checks by actually running the plugin | **L3** |
| How the host loads/calls/guards a plugin | a plugin-manager test that runs a real plugin (Node 22) | **L3** |
| The plugin → backend callback code | a quick unit test, plus one real-plugin run of the callback | L1 (+L3) |
| Which events get delivered to which plugin | a unit test with a faked message library | L1 |
| Broker connection / reconnect / delivery behaviour | a real-RabbitMQ test | **L4** |
| Database queries, storage, or migrations | a real-Postgres test | **L4** |
| Config / environment-variable parsing | parsing cases (valid + invalid) | L1 |
| The browser-side SDK (messaging, translations) | a happy-dom test; make sure **no token is ever sent out in a message** | L1 |
| Adding a new endpoint that isn't authenticated yet | a test that records the current (open) behaviour, with a TODO to lock it down | L2 |
| Startup/wiring code (`index.ts`) | pull the logic into its own file and unit-test that — don't import `index.ts`, it starts the server | L1 |

Rule of thumb: **start at L1** and move up only when a lighter test can't reach the risk. Security and
contract changes always get failure-case and golden-vector tests. Changes to how plugins run aren't
proven until a real plugin runs them (L3).

## How much to test

- Aim for very high coverage on the security- and contract-critical parts (signing, manifest rules,
  the backend callback, event delivery decisions, the browser-side messaging). Keep overall coverage
  from slipping over time.
- Don't chase 100%. We don't re-test the backend, we don't test the internals of libraries we depend
  on, and we don't test trivial startup glue. A few meaningful security/contract tests are worth more
  than padding the number.

## Continuous integration

`.github/workflows/plugin_host_ci.yml` runs automatically whenever files under `plugin-host/` change:

- **`unit`** — type-check + `npm test` (with coverage) for both packages. Runs on every pull request.
- **`wasm`** — downloads the `extism-js` compiler, builds the SDK and fixture, runs the L3 tests. If
  you upgrade the `@extism/js-pdk` version in the fixture, bump the matching `EXTISM_JS_VERSION` in
  the workflow.
- **`integration`** — runs the L4 tests against the Docker daemon that comes with the CI runner.

## Known behaviours pinned by tests

These are real, deliberately-documented behaviours. The tests assert them on purpose; if you fix the
underlying code, update the test to expect the new behaviour.

- **A plugin handler can't use real `async`/`await`.** Inside the WebAssembly sandbox, a handler that
  truly awaits a promise fails with a "did not settle synchronously" error. This is a limitation of
  the small JS engine the sandbox uses. In practice plugins don't hit it, because the backend-callback
  helper (`gzacApi`) already returns its result directly (the host pauses the plugin while it fetches)
  — so authors never need `await`. Documented by the L3 SDK test.
- **The plugin "data" endpoint is capability-gated, not authenticated.** The route a plugin's iframe
  uses to fetch its own data carries no HMAC (the caller is a browser, not GZAC); instead the host
  refuses to run the plugin unless the named configuration exists, targets that plugin version, and
  was granted the `frontend_data` capability — plus a per-configuration rate limit. The L2 tests
  pin both the refusals (400/403/429) and the success path.
- **A plugin with no message broker reads back as `null`.** When a configuration has no broker, the
  database stores nothing and reads it back as `null` (rather than "absent"). It's harmless — the code
  that uses it treats both the same — but the test documents the real behaviour. Pinned by the L4
  Postgres test.
