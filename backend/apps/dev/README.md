# Developer console (backend)

The application used for **local development**. It comes with demo cases and
sample data already set up, so you can explore Valtimo without configuring
anything. This is the one to run while working on the platform.

## How to start

From the repository root:

```bash
./gradlew :backend:apps:dev:bootRunWithDocker
```

This starts the supporting services (database, Keycloak, message broker, …) in
Docker and then launches the application. Once it's up, start one of the
frontend apps to use it in the browser.

## Epistola (document generation)

The [Epistola](https://epistola.app) plugin (`app.epistola.valtimo:epistola-plugin`, version in the
root `gradle.properties`) is part of the app. The stack runs the **Epistola Suite** demo image
(`localhost:4000`, API at `localhost:4000/api`) with its own Postgres. The demo profile seeds tenant
`demo` with API key `epk_demo_000000000000000000000000000000000000`, and the Suite UI accepts
`admin@local` / `admin`.

`src/main/resources/config/plugin-configurations/epistola.pluginconfig.json` deploys one
"Epistola Document Suite" configuration against it at startup. It reads `epistola.base-url`
(`EPISTOLA_BASE_URL`), `EPISTOLA_API_KEY` and `EPISTOLA_TENANT_ID`, each with the demo values as
default. Template sync is off: the app ships no templates of its own, so use the Suite's
demo catalog or import a catalog of your own. The image is `linux/amd64` only and runs emulated
on Apple silicon; give it a minute on first boot.

## External plugins

The stack also brings up the **plugin host** (`localhost:8090`) and the **demo app**
(`localhost:8095`), and the application provisions both at startup from
`src/main/resources/config/global/external-plugin/dev.externalplugin.json`. Startup itself never waits on
either of them: the integrations and one configuration of `case-summary` and of `demo-app` exist
from the moment the app is ready, and the 60-second discovery cycle marks them connected and their
plugins available as soon as the containers answer. So you can start the app with the containers
down, bring them up later, and it still converges — no restart. Restarting changes nothing either:
the descriptor's UUIDs are the row ids, so a redeploy recognises what it already created.

### Where the plugin itself comes from

The plugin host installs every `.zip` in `/data/preinstalled` at boot, and compose mounts
`plugin-host/sample-plugins/case-summary/dist` over it. `bootRunWithDocker` builds that zip for you
via the `buildSamplePlugin` Gradle task (effectively `npm --prefix plugin-host run setup`), which is
skipped once the zip is up to date. It needs **Node 22+**; without it the task logs a warning and
continues, the host starts with no plugins, and `case-summary` stays "Awaiting host" until you build
it yourself. Use `-PskipSamplePlugin` to skip it deliberately.

### The demo case

`config/case/case-summary-demo` is a case definition wired to the `case-summary` configuration:

- a **service task** (`BuildCaseSummary`) linked to the plugin's `case-summary` action, writing the
  result to the `caseSummary` process variable;
- a **case tab** ("Case summary (plugin)") of type `external_plugin`, rendering the plugin's
  `summary` bundle in an iframe.

Both reference the configuration id fixed in `dev.externalplugin.json`. The descriptor is imported
*after* case definitions (global imports run second), so on a first boot the tab and process link are
written before the configuration exists — which is tolerated: they carry the descriptor's stable id,
so they resolve as soon as the importer runs, and its `afterImport` retires the configuration issues
raised in the meantime.

See [`dev-docs/external-plugins/auto-deployment.md`](../../../dev-docs/external-plugins/auto-deployment.md)
for the descriptor format.
