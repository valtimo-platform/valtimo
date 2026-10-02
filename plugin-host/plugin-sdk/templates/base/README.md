# __PLUGIN_NAME__

A Valtimo external plugin, scaffolded with `valtimo-plugin-init`. It compiles to WebAssembly, is
packaged as a `.zip`, and is uploaded to a Valtimo plugin host.

## Project structure

```
manifest.json     # Identity, translations, configuration schema, actions, permissions
package.json      # Build scripts and the @valtimo/plugin-sdk dependency
tsconfig.json     # Type-checking only — esbuild does the compiling
src/
  plugin.ts       # Every handler this plugin registers, each with a comment explaining it
frontend/         # React bundles rendered in an iframe, if this project has any (see below)
dist/             # Build output (gitignored): plugin.wasm and __PLUGIN_ID__-__PLUGIN_VERSION__.zip
```

## Build and pack

```bash
npm install
npm run build:pack     # -> dist/__PLUGIN_ID__-__PLUGIN_VERSION__.zip
```

`build` bundles `src/plugin.ts` and compiles it to `dist/plugin.wasm`; `pack` validates
`manifest.json`, compiles any `frontend/*.tsx` bundle, and zips everything into an uploadable
package. **The first build is slow** — it downloads the Wasm toolchain (`extism-js` and binaryen).
The download is cached per user, so later builds take seconds.

Run `npx tsc --noEmit` to type-check without building.

## Upload and activate

Upload the `.zip` to a running plugin host over its signed admin API. Inside the Valtimo plugin-host
repository that is:

```bash
npm run plugin:upload -- dist/__PLUGIN_ID__-__PLUGIN_VERSION__.zip
```

Then, in the GZAC admin UI: activate the plugin version (accepting the capabilities
`manifest.json` declares under `permissions`), create a configuration of it, and wire its action
onto a BPMN service task via a process link. The action writes a `greeting` process variable.

## Editing the plugin

- **`src/plugin.ts`** — add handlers. `action("key", …)` runs from a process link, `onEvent(…)`
  receives platform events, `request("/path", …)` serves JSON to this plugin's own iframes.
- **`manifest.json`** — every handler needs a matching declaration. An `action` needs an entry in
  `actions[]`; an `onEvent` handler needs the event type in `eventSubscriptions`; anything that uses
  a host function (`log`, `gzacApi`, `kv`, `httpRequest`) or serves iframe data needs the capability
  in `permissions.capabilities`.
- **`translations`** — the plugin's name, description and every UI string, per locale. There are no
  top-level `name`/`description` fields; each declared locale must carry both.
- **`configurationSchema`** — the JSON Schema for what an administrator fills in per configuration.
  Read those values with `config.get("key")`.

### Pinning a GZAC version range

`manifest.json` may declare which GZAC versions the plugin supports. It is optional and left out by
default, because a range that is wrong is worse than no range at all:

```json
"compatibility": {"minGzacVersion": "12.0.0", "maxGzacVersion": "12.1.0"}
```

## Learn more

- [`@valtimo/plugin-sdk` README](https://www.npmjs.com/package/@valtimo/plugin-sdk) — the full SDK
  API: host functions, capabilities, egress declarations, and the browser-side iframe SDK.
- The `case-summary` sample plugin in the Valtimo plugin-host repository — the reference for
  everything this scaffold leaves out: `gzacApi` calls back into GZAC, outbound `httpRequest` with
  egress grants, the `kv` store, several bundles of the same type, and the other two levels of
  task-form submission.
