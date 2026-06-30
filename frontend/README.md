## Welcome to the Valtimo frontend

This folder contains:

- A collection of Angular libraries under `projects/valtimo/*` that together
  form the Valtimo frontend.
- Two application variants under `apps/`:
    - `apps/dev/` — the developer-loop console, with showcase components, demo
      routes, and the dev-only plugins enabled. This is what you serve when
      iterating on the libraries.
    - `apps/gzac/` — the template-equivalent application that is packaged into
      the released `ritense/gzac-frontend` Docker image. Imports the same
      shared set of feature modules directly in its `AppModule` but skips the
      dev showcase modules.

### Starting the Valtimo platform

Starting up the Valtimo platform requires two steps:

1. Starting the Valtimo backend. Instructions can be found
   [here](../backend/README.md#starting-the-valtimo-backend-from-source)
2. Starting the Valtimo frontend. Instructions can be found
   [here](#starting-the-valtimo-frontend-from-source)

### Starting the Valtimo frontend from source

#### Prerequisites: node

1. Install `nvm`. More information can be found [here](https://github.com/nvm-sh/nvm)
2. Install Node v20: `nvm install 20 && nvm use 20`

#### Install dependencies

Run the following command to install the dependencies: `npm install`.

#### Start application

Pick a variant to serve:

| Command                | Variant                              | Notes                                                                    |
|------------------------|--------------------------------------|--------------------------------------------------------------------------|
| `npm start`            | `apps/dev` (developer console)       | Default for library development. Showcase components, dev routes, devTabs. |
| `npm run start:gzac`   | `apps/gzac` (template-equivalent)    | Same shell as the released image but served with the dev `app-plugins` stub (no `@valtimo-plugins/*` required locally). |
| `npm run start:valtimo` | `apps/valtimo`                      | The Valtimo released app (`ritense/valtimo-frontend`). |
| `npm run start:evenementenvergunning` | `apps/evenementenvergunning` | The event-permit demo app (`ritense/gzac-evenementenvergunning-frontend`). |

Both serve at `http://localhost:4200/` by default. To run them side by side, pass
`-- --port 4201` to one of the commands.

Edits to library `*.ts` source files under `projects/valtimo/**` are picked up
automatically by `ng serve` — no manual rebuild required.

#### Production-config builds

`npm run build:dev` and `npm run build:gzac` produce optimised bundles via
`ng build <variant> --configuration production`. These swap in
`app-plugins.prod.ts` (which imports `@valtimo-plugins/{smtpmail,freemarker}`)
through Angular `fileReplacements`. Those plugin tarballs are **not** in
`frontend/package.json` — they are installed only inside CI by
`.github/workflows/frontend_build_push_docker_image.yml`'s
"Add release plugin dependencies" step (reading
[`release-plugins.json`](./release-plugins.json)). Running these commands on
your laptop will therefore fail to resolve `@valtimo-plugins/*`; that's
expected. Use CI to validate production builds.

#### Rebuilding libraries

The libraries are wired in via npm workspaces (`projects/valtimo/*` is symlinked into
`node_modules/@valtimo/*`), so most source changes are picked up live. You only need
to rebuild a library manually when:

- you change a library's `package.json`, `ng-package.json`, or assets, or
- you want to refresh the published artifacts in `dist/`.

Use `npm run libs:build:libraryName` for a single library or `npm run libs-build-all`
to rebuild every library. `npm run libs-build-all` is also what CI/CD and publishing use.

### Code quality

#### Running the linter

To run TSLint on a specific library, run `npm run libs:lint:libraryName`.

#### Code formatting

Valtimo uses Prettier to format its code. Run the `prettier:check` command to check for formatting
errors, and `prettier:write` to automatically fix any errors.

We advise to configure your IDE to automatically format files on save.

- For IntelliJ IDEA please refer to
  [this page](https://www.jetbrains.com/help/idea/prettier.html#ws_prettier_install).
- For VS Code you can refer to
  [this guide](https://scottsauber.com/2017/06/10/prettier-format-on-save-never-worry-about-formatting-javascript-again/).

Please make sure your code conforms to the project's Prettier code formatting rules before raising a
Pull Request.

#### Running unit tests

Run the following command to run the unit tests: `npm run libs:test:libraryName`.

#### Code guidelines

For contributing code, please refer to the [coding guidelines](CODING-GUIDELINES.md).

