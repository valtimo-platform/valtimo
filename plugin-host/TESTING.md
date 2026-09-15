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
| **L3 — Wasm** | Build a real plugin and actually run it in the sandbox. | Node ≥ 22 (Wasm toolchain downloads itself) |
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
npm run test:wasm        # L3 — needs Node 22 (the Wasm toolchain downloads itself)
npm run test:int         # L4 — needs Docker running
```

## What you need installed

- **Node.js** — `npm test` runs on any supported version. **L3 (`npm run test:wasm`) needs Node 22
  or newer.** That is because running a plugin uses a background worker thread that older Node
  versions can't start. (The part of L3 that needs Node 22 skips itself automatically on older
  versions, so nothing breaks — those tests just don't run.)
- **The Wasm toolchain (`extism-js` + `binaryen`)** — only for L3, and **you don't install it by
  hand**: the first plugin build downloads the pinned versions into `plugin-host/.bin/` (gitignored)
  automatically, both locally and on CI. Copies already on your `PATH` (e.g. `brew install binaryen`)
  are used as-is. The pins and download logic live in `plugin-sdk/bin/toolchain.mjs`; see the
  [SDK README](plugin-sdk/README.md#prerequisites) for the environment overrides.
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
`manifest-validation.test.ts`, `frontend/plugin-frontend-sdk.test.ts` and `scaffold/*.test.ts`.

> **"happy-dom".** The browser-side SDK code expects browser globals like `window`. Node doesn't have
> those, so that one test file runs in **happy-dom**, a lightweight fake browser. It's switched on per
> file with a one-line comment at the top (`// @vitest-environment happy-dom`).

> **Two fake terminals.** The scaffold wizard has two prompt harnesses, because it has two
> front-ends for its bundle question. `scaffold/prompts.test.ts` scripts a stream of *lines*, one per
> question as it is asked. `scaffold/checkbox.test.ts` fakes a `tty.ReadStream` (`isTTY`, `isRaw`,
> `setRawMode`) and writes *key sequences* — `ESC [ B` for down, `0x03` for Ctrl-C — one per
> redraw. In both, feeding the next answer only when the previous prompt has been written is what
> keeps them deterministic; pushing everything in up front loses all but the first.

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
- How the host runs several plugin calls at once (one sandbox instance refuses to be called twice at
  the same time, so the host keeps a small pool of them per plugin version and hands each call its
  own).
- Whether the memory cap really stops a runaway plugin (only the engine can enforce that, and only
  against a real module).

The tests use a small, purpose-built **fixture plugin** at `test-fixtures/test-plugin/`. (A *fixture*
is a fixed, reusable piece of test setup — here, a tiny real plugin with predictable handlers.) A
setup step compiles it to `.wasm` automatically before the tests run, so to add a case you just add a
handler to the fixture. The handlers it carries today:

| Handler | What it proves |
|---------|----------------|
| `echo` | The plugin sees its input — and never the host-only service token or callback URL. |
| `async-double` | The SDK settles a promise under QuickJS, which has no event loop. |
| `boom` / `boom-submit` | A thrown handler becomes an error envelope, not a host crash. |
| `spin` | The wall-clock timeout really cancels a stuck call, and the host recovers. |
| `burn` | Busy-waits a fixed time, so a test can show two calls to one plugin overlap (and serialise again when the pool maximum is 1). |
| `mem-bomb` | Allocates until the memory cap stops it — the call fails cleanly and the host serves the next one. |
| `call-gzac` | The backend callback works end to end, with the token attached by the host. |
| `/echo` request, `review` / `echo-submit` | The data route and the task-form submit hook. |

```bash
# from plugin-host/app, with Node 22 active (the Wasm toolchain downloads itself on first use)
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
| `plugin-sdk/src/test-support/scaffold-fixtures.ts` | Resolved options, and all 64 bundle subsets, for the scaffold generator's tests. |
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
| The plugin scaffold or its templates | generator unit tests (manifests must pass validatePluginManifest) + the CI scaffold-and-build job | L1 + CI |
| What a package may call itself (`pluginId`, `version`, `logo`) | rejection cases for anything that could name a path, plus a check that nothing was written outside the storage directory | L1/L2 |
| Anything that builds a path from a plugin-supplied string | a canonicalisation test proving the string you *check* is the string you *use* | L1 |
| The Wasm memory cap | patch the module, then let `WebAssembly` judge it: the patched module must still compile and must refuse to grow past the cap | L1 (+L3) |
| The instance pool (parallelism, limits, shutdown) | fake-factory tests for the semantics, plus one real-plugin run that shows two calls overlapping | L1 + **L3** |
| How a package is written to disk | concurrent installs, an overwrite that drops a file, and a failed load — each checking what is actually on disk afterwards | L1 |
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
- **`wasm`** — builds the SDK and fixture, runs the L3 tests. The Wasm toolchain (extism-js +
  binaryen) is downloaded automatically at the versions pinned in `plugin-sdk/bin/toolchain.mjs`;
  bump those pins together with the `@extism/js-pdk` version in the fixture.
- **`scaffold`** — runs `valtimo-plugin-init` and then builds and packs the generated project, twice:
  once with `--bundles all` (all six bundle types: `config`, `process-link-action`, `case-tab`,
  `case-widget`, `task-form`, `page`) and once with `--minimal`. This is the only job that compiles
  the `plugin-sdk/templates/` sources, which sit outside the SDK's `tsconfig` on purpose, so the
  `--bundles all` leg is what proves every bundle template still type-checks.
- **`integration`** — runs the L4 tests against the Docker daemon that comes with the CI runner.
- **`bootstrap`** — runs the documented one-command setup (`npm run setup -- --ci`) on Linux,
  Windows, and macOS and checks that the sample plugin package is produced.

## Known behaviours pinned by tests

These are real, deliberately-documented behaviours. The tests assert them on purpose; if you fix the
underlying code, update the test to expect the new behaviour.

- **A plugin handler can't use real `async`/`await`.** Inside the WebAssembly sandbox, a handler that
  truly awaits a promise fails with a "did not settle synchronously" error. This is a limitation of
  the small JS engine the sandbox uses. In practice plugins don't hit it, because the backend-callback
  helper (`gzacApi`) already returns its result directly (the host pauses the plugin while it fetches)
  — so authors never need `await`. Documented by the L3 SDK test.
- **The plugin "data" endpoint is capability-gated and user-token-authenticated.** The route a
  plugin's iframe uses to fetch its own data carries no HMAC (the caller is a browser, not GZAC);
  the host refuses to run the plugin unless the named configuration exists, targets that plugin
  version, and was granted the `frontend_data` capability — plus a per-configuration rate limit —
  and the request must carry a GZAC-minted downscoped user token, which the host validates by
  remote introspection against GZAC and requires to be bound to the named configuration. GZAC
  being unreachable fails closed (503) — Wasm never runs on an unvalidated token. The L2 tests pin
  the refusals (400/401/403/429/503), the cached-introspection path, and the success path.
- **A plugin with no message broker reads back as `null`.** When a configuration has no broker, the
  database stores nothing and reads it back as `null` (rather than "absent"). It's harmless — the code
  that uses it treats both the same — but the test documents the real behaviour. Pinned by the L4
  Postgres test.
