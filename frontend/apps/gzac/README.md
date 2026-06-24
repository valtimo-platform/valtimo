# `frontend/apps/gzac`

The template-equivalent Angular application. This is what gets packaged into
the released `ritense/gzac-frontend` Docker image. Structurally mirrors
`~/Projects/gzac-frontend-template/src/` with two monorepo-specific additions:

- An `app-plugins.ts` / `app-plugins.prod.ts` pair (mirroring `apps/dev`) so
  the variant compiles locally without `@valtimo-plugins/{smtpmail,freemarker}`
  installed. Production builds swap in `app-plugins.prod.ts` via Angular
  `fileReplacements`.
- A sibling `environment.prod.ts` (with `production: true`) so
  `enableProdMode()` actually fires in release builds. The template's
  upstream `src/` ships only `environment.ts`.

The shared `NgModule` wiring is imported from
[`@valtimo/app-shell`](../../projects/valtimo/app-shell/). The only feature
module that's gzac-only (not in `apps/dev`) is `SseModule` from `@valtimo/sse`.

## Start

| Command                          | Result                                                                   |
|----------------------------------|--------------------------------------------------------------------------|
| `npm run start:gzac`             | `ng serve gzac --proxy-config proxy.conf.json` on `http://localhost:4200`. |
| `npm run start:gzac -- --port 4201` | Same, on a different port (useful when `npm start` already holds 4200). |

`ng serve gzac` works locally because it uses the empty `app-plugins.ts` stub
— the `@valtimo-plugins/*` tarballs are only required for the
`--configuration production` build, which is exercised in CI by
[`.github/workflows/frontend_build_push_docker_image.yml`](../../../.github/workflows/frontend_build_push_docker_image.yml).

## Production build (CI only)

`npm run build:gzac` runs `ng build gzac --configuration production`. Locally
this fails because the `@valtimo-plugins/*` peer imports (`@valtimo/security`,
`@valtimo/plugin`, `@valtimo/components`, `@valtimo/shared`) cannot be
resolved through the monorepo's workspace symlinks. CI handles this in
`frontend_build_push_docker_image.yml` by:

1. Downloading the pre-built library dist artifact.
2. Rewriting `frontend/package.json`'s `@valtimo/*` devDependencies to
   `file:dist/valtimo/*` paths and deleting the `workspaces` field.
3. Running `npm install` so each `@valtimo/*` lands in `node_modules` as a
   real package (not a workspace symlink).
4. Then `npm run build:gzac`.

To package the resulting image, the workflow passes `--build-arg VARIANT=gzac`
to `docker build`, which `frontend/Dockerfile` uses to pick the right
`deployment/${VARIANT}/browser` directory.
