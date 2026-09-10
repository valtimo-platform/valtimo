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

**New to the external plugin system?** Read
[How a plugin works with Valtimo](./develop-a-plugin.md#how-a-plugin-works-with-valtimo) first —
the lifecycle, the permission model, and how to pick a surface. It applies to apps just as much as
to packaged plugins, and the reference material below is hard to use without it.

| Document | For | Covers |
|---|---|---|
| [Developing an external plugin](./develop-a-plugin.md) | Plugin developers | How a plugin works with Valtimo, choosing a surface, the sandbox and its limits, scaffolding with `valtimo-plugin-init`, the manifest, the SDK backend API, frontend bundles, build/pack/upload, debugging, versioning |
| [Developing an app](./develop-an-app.md) | App developers | The GZAC↔integration contract a standalone service must implement, and the minimum subset of it |
| [The Valtimo API and event catalogue](./valtimo-api-and-events.md) | Plugin and app developers | Which API endpoints a plugin can reach and how to discover them, service vs user identity, endpoints no grant unlocks, and every event type with its payload |
| [Host configuration & deployment](./host-configuration-and-deployment.md) | Operators | Docker, environment reference, TLS, pre-installed packages, scaling, operational runbook |
| [Auto-deployment](./auto-deployment.md) | Implementation developers | Declaring integrations, packages, and configurations in `*.externalplugin.json` descriptors |

Reference material next to this folder: the [plugin-host README](../README.md) (quick start,
bootstrap commands), the [host app README](../app/README.md) (API reference, HMAC scheme,
transport security), the [SDK README](../plugin-sdk/README.md) (CLI reference, toolchain, frontend
SDK), and [TESTING.md](../TESTING.md) (test layers and when to use which).
