# External Plugin SDK (Backend)

NPM package (`@valtimo/plugin-sdk`) for building Valtimo external plugins that compile to WebAssembly.

## What It Provides

1. **TypeScript types** — `ActionInput`, `ActionOutput`, `PluginManifest`, etc.
2. **Runtime helpers** — `action()`, `config`, `log` for use inside plugin code
3. **`valtimo-plugin-init` CLI** — Scaffolds a complete, buildable plugin project in one command
4. **`valtimo-plugin-build` CLI** — Compiles TypeScript plugin source to `.wasm` (via esbuild + extism-js)
5. **`valtimo-plugin-pack` CLI** — Assembles a `.zip` package (`manifest.json` + `plugin.wasm`) ready for upload

## Project Structure

```
src/
  models/
    types.ts        # Core type definitions
    index.ts        # Barrel export
  actions.ts        # action() handler registry
  config.ts         # config.getAll() / config.get(key) — call-scoped configuration
  host-functions.ts # log.info/warn/error — logging facade
  runtime.ts        # Wasm dispatcher: handleAction(), handleGetManifest()
  scaffold/         # The plugin generator behind valtimo-plugin-init (@valtimo/plugin-sdk/scaffold)
  index.ts          # Public API barrel export
templates/          # Files valtimo-plugin-init copies into a new project (see templates/README.md)
bin/
  valtimo-plugin-init.mjs   # templates/ + src/scaffold/ → a new plugin project
  valtimo-plugin-build.mjs  # TS → JS (esbuild) → .wasm (extism-js)
  valtimo-plugin-pack.mjs   # manifest.json + plugin.wasm → .zip
```

## Prerequisites

- Node.js 18+ (Node 22+ to also run the plugin host)

That's it — the Wasm toolchain (`extism-js` and binaryen's `wasm-merge`/`wasm-opt`, which
extism-js calls) is **provisioned automatically** by `valtimo-plugin-build` on first use, on
Linux, macOS, and Windows. Copies already on your `PATH` (e.g. from `brew install binaryen`) are
used as-is; anything missing is downloaded at a pinned version (sha256-verified) into:

- `plugin-host/.bin/` (gitignored) when the SDK lives in this repository
- `~/.valtimo-plugin-sdk/toolchain/` when installed from npm

The shared logic lives in [`bin/toolchain.mjs`](./bin/toolchain.mjs) (importable as
`@valtimo/plugin-sdk/toolchain`) and honours these environment overrides:

| Variable | Effect |
|---|---|
| `VALTIMO_PLUGIN_TOOLCHAIN_DIR` | Install/download directory for the toolchain |
| `VALTIMO_EXTISM_JS` | Absolute path to an `extism-js` binary to use as-is |
| `EXTISM_JS_VERSION` | extism-js release to download (default pinned in `toolchain.mjs`) |
| `BINARYEN_VERSION` | binaryen release to download (default pinned in `toolchain.mjs`) |

## Building the SDK

```bash
npm install
npm run build   # tsc → dist/
```

## CLI Tools

### `valtimo-plugin-init`

Scaffolds a new plugin project — `manifest.json`, `package.json`, `tsconfig.json`, `.gitignore`, a
README and `src/plugin.ts` with a registered action — wired so that `npm run build:pack` produces an
uploadable package with no edits.

```bash
npx --package @valtimo/plugin-sdk valtimo-plugin-init my-plugin
```

On a terminal it asks nine questions — the identity fields, then which frontend bundles to generate.
Everything has a default, so pressing Enter throughout is a valid answer:

```
? Plugin id                                  (my-plugin)
? Version                                    (0.1.0)
? Add an English ('en') translation bucket?  (Y/n)
? Add a Dutch ('nl') translation bucket?     (y/N)
? Display name (en)                          (My Plugin)
? Description (en)                           (A Valtimo external plugin)
? Provider
? Add an onEvent handler?                    (Y/n)

  Frontend bundles:  ↑/↓ move · space toggles · a all · n none · enter confirms

  > [x] config               admin — the plugin configuration form
    [ ] process-link-action  admin — the action's form in the process-link stepper
    [x] case-tab             user  — a tab on a case
    [ ] case-widget          user  — a widget on a case
    [ ] task-form            user  — a form on a user task (can validate the submission)
    [x] page                 user  — a menu-mounted page
```

Confirming collapses the list into one line, so the finished transcript reads like the rest:

```
? Frontend bundles                           config, case-tab, page

[valtimo-plugin-init] Created my-plugin/ (12 files)
...
Next steps:
  cd my-plugin
  npm run build:pack     # -> dist/my-plugin-0.1.0.zip
```

**If either end is redirected** — `valtimo-plugin-init > setup.log`, or anywhere raw mode is
unavailable — the same question is asked as a numbered list on one line instead, taking numbers
(`1,3,6`), names (`config,case-tab,page` — the same words `--bundles` takes), `all`, `none`, or
nothing at all for the default:

```
? Frontend bundles (numbers, 'all', 'none')  (1) 1,3,6
```

Either way the answer is a **set**: the project generated from `3,1` is byte-identical to the one
from `1,3`, and identical again to `--bundles case-tab,config`.

| Flag | Effect |
|---|---|
| `[directory]` | Target directory. Defaults to `.` (the plugin id then derives from the current directory name). |
| `--plugin-id <id>` | Plugin id; lowercase, alphanumeric at both ends. Skips the id prompt. |
| `--version <v>` | Manifest/package version (default `0.1.0`). |
| `--name <s>` / `--description <s>` / `--provider <s>` | `translations.<locale>.name`, `.description`, and `provider`. |
| `--locales en,nl` | Translation buckets to create (default `en`). Skips both locale prompts. |
| `--bundles <list>` | Frontend bundle types by name, or `all` / `none` (default `config`). Skips the bundle prompt. |
| `--with-config` / `--with-case-tab` | Aliases for `--bundles config` / `--bundles case-tab`. They compose: naming both selects both. |
| `--with-event` | Include an `onEvent` handler. |
| `--minimal` | No `onEvent` handler and no bundles (base only). |
| `--sdk <spec>` | Override the `@valtimo/plugin-sdk` dependency, e.g. `file:../../plugin-sdk`. Defaults to `^<this SDK's version>`. |
| `--yes`, `-y` | Never prompt; take defaults for anything not supplied. |
| `--no-install` | Skip `npm install` after generating. |
| `--force` | Write into a non-empty directory. |
| `--help`, `-h` | Usage. |

`--with-frontend` was retired when the other four bundle types were added: "the frontend" no longer
names one thing. It exits 1 pointing at `--bundles`.

**What each bundle adds.** The base project is one `action()` handler plus the manifest entry that
makes it selectable on a BPMN service task, and `--with-event` adds an `onEvent()` handler with its
`eventSubscriptions` entry. Each bundle then contributes two `frontend/` files, a `frontendBundles`
entry, its translation keys, and — where it has one — a backend handler:

| Bundle | Generated | Backend |
|---|---|---|
| `config` | `frontend/config.{html,tsx}`, a `configurationSchema`, an unkeyed `config` bundle, `config.*` keys. The action then reads its `greeting` from the configuration as well as from the BPMN property. | — |
| `process-link-action` | `frontend/action-config.{html,tsx}`, a bundle keyed on the plugin id (which is how GZAC matches it to `actions[0]`), `actionConfig.*` keys. Replaces the form GZAC would generate from `actions[].properties`. | — |
| `case-tab` | `frontend/case-tab.{html,tsx}`, a bundle keyed `summary`, `caseTab.*` keys, the `frontend_data` capability. | `request("/summary")` |
| `case-widget` | `frontend/case-widget.{html,tsx}`, a bundle keyed `summary`, `caseWidget.*` keys, the `frontend_data` capability. | `request("/summary")` |
| `task-form` | `frontend/task-form.{html,tsx}`, a bundle keyed `review` with `submitHandler: true`, `taskForm.*` keys. The only surface that can **reject** what a user did. | `submit("review")` |
| `page` | `frontend/page.{html,tsx}`, a bundle keyed `overview` with an `icon` and a **translation-key** `title`, `page.*` keys including `page.overview.title`, the `frontend_data` capability. | `request("/summary")` |

`case-tab`, `case-widget` and `page` share one `request()` handler and one `frontend_data`
declaration however many of them are selected — they run on identical machinery and differ only in
where they mount and what context they receive.

**Why `config` is the default, and nothing else.** It is the only bundle type with a structural
claim to it: unkeyed, at most one per plugin, and admin-facing plumbing — *how the plugin gets
configured at all* — rather than a choice about which product surface to build. Defaulting any of
the other five would privilege one user-facing surface over its peers, which is exactly what
`--bundles` exists to stop. `--minimal` opts out of everything and composes with the rest:
`--minimal --bundles page` gives the action plus a menu page and nothing else.

**Locales.** `en` and `nl` are asked about separately — neither is assumed — and declining both is
refused, because `name` and `description` exist only inside a locale bucket. The questions come
before the display name so the `Display name (en)` label names the bucket the answer lands in.
Declining `en` is allowed but warned about: `sdk.t()` resolves active locale → `en` → raw key, so a
plugin with no `en` bucket shows translation keys to anyone on a third locale. `--locales` covers
any other tag (`--locales en,nl,de`); locales the scaffold has no strings for reuse the English ones
for each bundle's fixed keys.

**Working inside this repository**, `@valtimo/plugin-sdk` is not resolvable from the registry yet,
so point the generated dependency at the local package:

```bash
node bin/valtimo-plugin-init.mjs ~/tmp/my-plugin --sdk "file:$PWD"
```

### `valtimo-plugin-build`

Compiles a plugin's TypeScript source into a `.wasm` module.

```bash
valtimo-plugin-build [--input src/plugin.ts] [--output plugin.wasm]
```

Steps performed:
1. Bundles the source with esbuild (CJS format, required by QuickJS) using the esbuild installed
   in the plugin project
2. Compiles the bundle to `.wasm` via the `extism-js` CLI (with binaryen on its `PATH`)
3. If `index.d.ts` exists in the plugin directory, passes it to extism-js with `-i` to declare exports

The CLI locates `extism-js` in this order (see [Prerequisites](#prerequisites)):
1. `VALTIMO_EXTISM_JS` (explicit path)
2. System `PATH`
3. A previously downloaded copy (toolchain dir, `node_modules/.bin`, `plugin-host/.bin`)
4. Automatic download of the pinned release

### `valtimo-plugin-pack`

Assembles a plugin `.zip` ready for upload to the Plugin Host.

```bash
valtimo-plugin-pack [--wasm plugin.wasm] [--manifest manifest.json] [--output .]
```

Reads `pluginId` and `version` from `manifest.json` and produces `{pluginId}-{version}.zip` containing:
- `manifest.json` — with `sdkVersion` stamped on, so the host can tell which SDK/ABI a stored plugin
  targets. The value is the version the **plugin project** resolves for `@valtimo/plugin-sdk`
  (self-reported by the SDK, resolved from the plugin's `cwd` exactly as esbuild is) — i.e. the SDK
  the wasm was compiled against, not the one that happens to be running the pack tool. Those differ
  under `npx`, a global install, or two hoisted copies; the pack tool warns and stamps the plugin's
- `plugin.wasm`
- `frontend/` (if the directory exists)

## SDK API (for plugin authors)

```typescript
import { action, config, log } from "@valtimo/plugin-sdk";

// Register an action handler
action("my-action", (input) => {
  const myConfigValue = config.get("someKey");
  log.info("Executing my-action");
  return { status: "completed", variables: { result: "done" } };
});

// config.getAll()  — returns the full configuration object
// config.get(key)  — returns a single configuration value
// log.info(msg)    — log at info level
// log.warn(msg)    — log at warn level
// log.error(msg)   — log at error level
```

### Capabilities

Host functions only work when the admin granted the matching capability at activation:
`gzac_api`, `http_request`, `kv`, `log`. A fifth capability, `frontend_data`, gates the host's
`POST /plugins/:id/:version/data` route — without it the host refuses to execute the
plugin's `handle_request` for that configuration, so declare it under
`permissions.capabilities` in `manifest.json` when the plugin serves data to its own iframes.
The `/data` route also requires a GZAC-minted downscoped user token, which the host validates
against GZAC before executing any Wasm; the Angular parent-proxy attaches it automatically, so
`sdk.getPluginData(...)` calls only succeed for authenticated users of the configuration's GZAC
instance.

### Declaring `http_request` destinations

`http_request` is deny-by-default: the capability alone reaches nothing. Every destination has to be
declared, from one of two places depending on who knows its value.

```json
{
  "permissions": {
    "capabilities": ["http_request"],
    "egress": ["api.kvk.nl", "https://svc.vendor.com:8443"]
  },
  "configurationSchema": {
    "properties": {
      "smartDocumentsUrl": { "type": "string", "format": "uri", "x-egress-target": true }
    }
  }
}
```

- **`permissions.egress`** — origins that are the same in every environment. The admin accepts them
  on the activation screen, and they cannot change without re-accepting the plugin version.
- **`x-egress-target`** — put it on the configuration property that holds a URL which differs per
  customer or environment. The admin typing the value *is* the grant, so there is nothing extra to
  accept and the destination follows the configuration when it is edited. The property must be a
  string with `"format": "uri"`.

Entries are **origins**, matched on scheme + host + port:

- A scheme-less entry means https on 443. Write `http://…` explicitly for a plain-http target.
- A missing port means the scheme's default port, not any port — declare
  `https://svc.internal:8443` if that is the port you call.
- The path is ignored; a grant covers the whole origin. Do not include one.
- A leading `*.` wildcard is allowed with at least two labels after it (`*.vendor.com`, never
  `*.com`) and matches exactly one label — `api.vendor.com` but not `vendor.com` or
  `a.b.vendor.com`. Prefer explicit hosts: a wildcard under your own DNS is a much wider grant, and
  it is flagged as such on the admin's acceptance screen.

Declaring `egress` without `http_request` in `capabilities` fails validation, as does an unparseable
entry — the pack tool catches both before the package is built.

## Frontend SDK (`@valtimo/plugin-sdk/frontend`)

The browser-side `ValtimoPluginSDK` runs inside the plugin's iframe and talks to the Valtimo
(Angular) parent via `postMessage`.

```typescript
import { ValtimoPluginSDK } from "@valtimo/plugin-sdk/frontend";

// Recommended for production: pin the hosting Valtimo frontend's origin. Inbound messages from
// any other origin are ignored and every outgoing message is posted to this origin only.
const sdk = new ValtimoPluginSDK({ parentOrigin: "https://valtimo.example.com" });
```

When `parentOrigin` is omitted (e.g. one bundle deployed under several Valtimo frontends), the
SDK pins the origin of the first `init` message it receives and ignores other origins from then
on. Until that pin exists, only the credential-free handshake events (`ready`, `resize`) are sent
with a `"*"` target; anything carrying data is queued and flushed to the pinned origin after
`init`. Pass `parentOrigin` whenever the hosting origin is known at build/deploy time.
