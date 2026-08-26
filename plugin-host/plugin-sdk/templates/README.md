# Scaffold templates

Payload for `valtimo-plugin-init`. Every file here is copied into a newly generated plugin project
by `src/scaffold/generate.ts`, with `__TOKEN__` placeholders substituted. They are **not** compiled
by the SDK's `tsc` (which only sees `src/**/*`) and not collected by vitest — they are data, not
code, and are shipped by the `templates` entry in the package's `files` list.

Because nothing here is type-checked at SDK build time, the `scaffold` job in
`.github/workflows/plugin_host_ci.yml` scaffolds a project from these templates, installs it, runs
`tsc --noEmit` over it, and builds and packs it. That job is what proves these files still compile;
if you edit anything here, expect it to be the thing that catches your mistake.

## Layout

| Path | Copied to | When |
|---|---|---|
| `base/_gitignore` | `.gitignore` | always |
| `base/README.md` | `README.md` | always (fragments appended) |
| `base/src/plugin.ts` | `src/plugin.ts` | always (fragments appended) |
| `fragments/on-event.ts` | appended to `src/plugin.ts` | `--with-event` |
| `fragments/request.ts` | appended to `src/plugin.ts` | any of `case-tab`, `case-widget`, `page` — **once** |
| `fragments/submit.ts` | appended to `src/plugin.ts` | `task-form` |
| `fragments/readme-*.md` | appended to `README.md` | the bundle named in the filename |
| `frontend-config/frontend/config.{html,tsx}` | `frontend/` | `--bundles config` |
| `frontend-process-link-action/frontend/action-config.{html,tsx}` | `frontend/` | `--bundles process-link-action` |
| `frontend-case-tab/frontend/case-tab.{html,tsx}` | `frontend/` | `--bundles case-tab` |
| `frontend-case-widget/frontend/case-widget.{html,tsx}` | `frontend/` | `--bundles case-widget` |
| `frontend-task-form/frontend/task-form.{html,tsx}` | `frontend/` | `--bundles task-form` |
| `frontend-page/frontend/page.{html,tsx}` | `frontend/` | `--bundles page` |

Nothing in `src/scaffold/` hardcodes these paths. Each one is named on a descriptor in
`src/scaffold/parts.ts`, which is the single table saying what a part contributes; a seventh bundle
type is a new entry there plus a directory here, and no change to the generator.

`manifest.json`, `package.json` and `tsconfig.json` are **not** templated. They need a different set
of keys per selected part, which is miserable as string substitution, so they are assembled as
objects in `src/scaffold/json-files.ts` and serialised with `JSON.stringify(…, null, 2)`.

## Tokens

Substituted in file **contents** only — there are no templated file names. The pattern is
`__UPPER_SNAKE__`, and an unrecognised token left in the output is a hard error
(`substituteTokens` throws), so a renamed token fails a unit test instead of shipping
`__PLUGIN_ID__` into someone's plugin.

| Token | Value |
|---|---|
| `__PLUGIN_ID__` | the `pluginId`, e.g. `my-plugin` |
| `__PLUGIN_NAME__` | the English display name, e.g. `My Plugin` |
| `__PLUGIN_VERSION__` | the version, e.g. `0.1.0` |
| `__SDK_IMPORTS__` | the generated `import` block for `src/plugin.ts` — only the symbols the selected parts actually use |
| `__GREETING_SOURCE__` | the expression the base action reads its greeting from; gains a `config.get("greeting")` term when the config bundle is selected |
| `__BUNDLE_KEY__` | the key of the bundle whose file is being rendered, e.g. `summary`, `review`, `overview`; empty for the unkeyed `config` bundle |
| `__BUNDLE_STEM__` | that bundle's file stem, e.g. `case-tab` — what its `.html` names as its compiled `.bundle.js` |

The last two are available **only** when rendering a file that belongs to one bundle: its two
`frontend/` files, its README fragment, and its backend fragment. A base template that referenced
either would fail to render rather than quietly emitting an empty string.

## Why these files carry no licence header

Every other file in this package starts with the EUPL header, because Ritense wrote it. These files
are different: their content is copied verbatim into someone else's project, so a Ritense copyright
notice on it would be wrong. The generated `package.json` is `private: true` with no `license` field
for the same reason — the scaffolded project belongs to its author. New files under `src/scaffold/`
and `bin/` are ordinary SDK source and **do** get the header.

## `_gitignore`, not `.gitignore`

`npm publish` silently drops `.gitignore` from the tarball, whatever the `files` list says. The
template therefore ships as `_gitignore` and the generator renames it on write. The unit tests in
`src/scaffold/generate.test.ts` assert the generated project has `.gitignore` and no `_gitignore`.
