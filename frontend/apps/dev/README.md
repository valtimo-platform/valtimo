# `frontend/apps/dev`

The developer-loop Angular console. This is what `npm start` serves by default
and is the variant library authors iterate against.

Includes everything the released `apps/gzac` variant has plus:

- The `@valtimo/components` `FormIoModule` and `UploaderModule`.
- `@valtimo/form-view-model`.
- `KlantinteractiesApiPluginModule` and `OpenKlantTokenAuthenticationPluginModule`
  from `@valtimo/plugin` (with the matching plugin specs in `PLUGINS_TOKEN`).
- All showcase components under `src/app/`: `clock-widget`,
  `custom-angular-form-example`, `custom-building-block-tab`, `custom-case-tab`,
  `custom-form-component`, `custom-form-example`, `custom-form-flow-component`,
  `custom-maps-tab`, `form-io`, `notification-test`,
  `start-process-custom-form`, `upload-showcase`.
- Dev-only routes/components wired through
  [`src/app/dev-tools.ts`](./src/app/dev-tools.ts) (swapped with `no-dev-tools.ts`
  in `--configuration production` via Angular `fileReplacements`).

The shared `NgModule` wiring (layout, security, plugins, etc.) is declared
directly in [`src/app/app.module.ts`](./src/app/app.module.ts) alongside the
variant-specific bits. The gzac variant keeps the same shared set; only the
dev-only modules listed above are absent there.

## Start

| Command       | Result                                                                  |
|---------------|-------------------------------------------------------------------------|
| `npm start`   | `ng serve dev --proxy-config proxy.conf.json` on `http://localhost:4200`. |

## Plugin imports

The `@valtimo-plugins/*` packages are excluded from local installs (their
compiled `.mjs` files import `@valtimo/*` from `node_modules`, which conflicts
with the monorepo's tsconfig-paths workspace resolution). For local serve and
test builds the empty `app-plugins.ts` stub is used; production builds swap in
`app-plugins.prod.ts` via `fileReplacements`. See
[`release-plugins.json`](../../release-plugins.json) for the version pins CI
installs before the production build.
