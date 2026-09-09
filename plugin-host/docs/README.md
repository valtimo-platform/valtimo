<!--
  Copyright 2015-2026 Ritense BV, the Netherlands.
  Licensed under EUPL, Version 1.2 (the "License");
  https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
-->

# External plugin system — developer documentation

Developer and operator documentation for the external plugin system. The administrator-facing
documentation (connecting integrations, uploading, configuring, permissions) lives in the main
docs under
[`documentation/configuration-guides/plugins/`](../../documentation/configuration-guides/plugins/README.md);
the concept introduction is
[What is an external plugin?](../../documentation/fundamentals/external-plugins.md)

| Document | For | Covers |
|---|---|---|
| [Developing an external plugin](./develop-a-plugin.md) | Plugin developers | Scaffolding with `valtimo-plugin-init`, the SDK backend API, frontend bundles, the manifest and permission model, build/pack/upload, versioning |
| [Developing an app](./develop-an-app.md) | App developers | The GZAC↔integration contract a standalone service must implement |
| [Host configuration & deployment](./host-configuration-and-deployment.md) | Operators | Docker, environment reference, TLS, pre-installed packages, scaling, operational runbook |
| [Auto-deployment](./auto-deployment.md) | Implementation developers | Declaring integrations, packages, and configurations in `*.externalplugin.json` descriptors |

Reference material next to this folder: the [plugin-host README](../README.md) (quick start,
bootstrap commands), the [host app README](../app/README.md) (API reference, HMAC scheme,
transport security), the [SDK README](../plugin-sdk/README.md) (full SDK and CLI reference),
[TESTING.md](../TESTING.md) (test layers and when to use which), and the reference
implementations [`sample-plugins/case-summary/`](../sample-plugins/case-summary/) (plugin) and
[`sample-apps/demo-app/`](../sample-apps/demo-app/) (app).
