<!--
  Copyright 2015-2026 Ritense BV, the Netherlands.
  Licensed under EUPL, Version 1.2 (the "License");
  https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
-->

# Valtimo Developer Documentation

Technical documentation for developers, operators, and implementers working with the Valtimo
platform. For administrator and end-user documentation, see the published docs at
[docs.valtimo.nl](https://docs.valtimo.nl) (sources under [`documentation/`](../documentation/SUMMARY.md)).

## Getting Started

- [Development Setup](./getting-started/development-setup.md) — prerequisites and environment setup

## External Plugin System

Build plugins that extend Valtimo with custom actions, screens, and integrations:

- [Developing a Plugin](./external-plugins/develop-a-plugin.md) — the complete plugin development
  guide
- [Developing an App](./external-plugins/develop-an-app.md) — building a standalone service that
  integrates with Valtimo
- [API and Events Reference](./external-plugins/valtimo-api-and-events.md) — what your plugin can
  call and react to
- [Auto-deployment](./external-plugins/auto-deployment.md) — infrastructure-as-code for plugin
  environments

## Operations

- [Plugin Host Deployment](./operations/plugin-host-deployment.md) — Docker, environment reference,
  scaling
