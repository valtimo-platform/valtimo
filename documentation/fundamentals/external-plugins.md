# What is an external plugin?

An external plugin is an extension that adds new behavior to Valtimo — actions for processes,
reactions to events, and screens such as case tabs — without changing or rebuilding the Valtimo
application itself. External plugins are built and shipped independently, run outside the Valtimo
backend, and are connected to Valtimo by an administrator.

External plugins exist so that:

- New integrations and features can be added to a running Valtimo environment without a new
  Valtimo release or deployment.
- Plugin code from a third party runs isolated from the platform, with access limited to exactly
  what an administrator approved.
- The same plugin package can be installed in many environments, each with its own settings.

## How external plugins work

External plugins do not run inside the Valtimo backend. They run on a separate service, and
Valtimo communicates with that service over HTTP:

- A **plugin host** is a lightweight service that stores uploaded plugin packages and runs them in
  a secure sandbox. One plugin host can run many plugins, and many versions of the same plugin
  side by side.
- An **app** is a remote service that behaves like a plugin host with exactly one built-in plugin.
  It is added by URL and cannot receive uploads — it *is* the plugin.

Together, plugin hosts and apps are called **integrations**.

```
┌──────────────┐   discovers plugins, pushes configurations   ┌──────────────┐
│    Valtimo   │ ───────────────────────────────────────────▶ │ Plugin host  │
│              │ ◀─────────────────────────────────────────── │   or app     │
│              │      calls back with a scoped token          │  (runs the   │
│              │                                              │   plugins)   │
└──────────────┘   invokes actions, delivers events           └──────────────┘
```

Valtimo checks in with every integration regularly (every minute by default). It discovers which
plugins and versions the integration offers, keeps their status up to date, and re-sends every
active configuration together with a fresh, short-lived access token.

### Key components

#### Plugin definition

A plugin discovered on an integration, identified by its id and version (for example
`case-summary 0.1.0`). Multiple versions of the same plugin can be available at the same time —
existing cases keep using the version they were built with, while new cases can use a newer one.

#### Plugin configuration

An activated instance of a plugin definition. The administrator gives it a name, fills in the
plugin's settings, and accepts the permissions it requests. A plugin only ever runs through one of
its configurations, and each configuration is limited to what was accepted for it.

#### Permissions

Every plugin package declares up front what it needs:

- **Host capabilities** — abilities such as calling the Valtimo API, making outbound HTTP
  requests, storing key–value data, or writing logs.
- **API endpoints** — exactly which Valtimo API endpoints the plugin may call.
- **Events** — which platform events the plugin wants to receive.
- **External connections** — which outside addresses the plugin may contact.

During activation the administrator reviews and accepts this complete list. The plugin can never
do more than what was accepted: every call is checked again at runtime, and a request outside the
accepted set is refused. A new plugin version that asks for more does not receive it until an
administrator reviews and accepts again.

#### Security model

The security model rests on a few principles:

- **Sandboxed execution** — plugin backend code runs in an isolated sandbox on the plugin host,
  with no direct access to the network, the file system, or Valtimo.
- **Scoped, short-lived tokens** — when a plugin calls back into Valtimo it uses a token that is
  limited to the accepted endpoint list and expires within minutes. Plugin screens acting on
  behalf of a logged-in user are additionally limited to what that user is allowed to see and do.
- **Signed traffic** — every request Valtimo sends to an integration is cryptographically signed,
  so an integration only accepts instructions from the Valtimo environment that holds its secret.
- **Tamper detection** — Valtimo records a fingerprint of every plugin package it accepted. If
  the package on the host changes without an approved upload, the plugin is suspended on every
  surface until an administrator reviews the change.
- **Isolated screens** — plugin screens render in a locked-down frame that never holds a token
  and cannot read anything from the Valtimo application around it.

## Where external plugins appear

Once configured, an external plugin can take part in the platform in the same places embedded
functionality does:

- **Process actions** — a service task in a process executes a plugin action; results can be
  written back to the case or to process variables.
- **Events** — the plugin reacts to platform events, such as a document being created.
- **Case tabs and case widgets** — the plugin renders its own screen inside the case detail page.
- **Task forms** — the plugin renders the form for a user task.
- **Menu pages** — the plugin adds its own page to the navigation menu.

## Relationship to other concepts

- **Plugins (embedded)** — Valtimo also ships plugins that run inside the backend itself. Both
  kinds appear in the same admin screens and are linked to processes the same way; external
  plugins add isolation, independent delivery, and an explicit permission model.
- **Cases and processes** — external plugin actions and forms are connected to process activities
  through process links, exactly like embedded plugin actions and forms.
- **Access control** — plugin screens acting for a user always stay within that user's
  permissions; access to case tabs and widgets is governed by the standard access control rules.

## Learn more

- [Configuration guide: External plugins](../configuration-guides/plugins/external-plugins/README.md)
- [Plugin status and reviews](../configuration-guides/plugins/external-plugins/plugin-status-and-reviews.md)
  — what it means when a plugin needs attention
- Building plugins and apps, and running a plugin host, are developer and operator tasks. That
  documentation ships with the Valtimo source code rather than here; ask your development team for
  it if you need to pass requirements to a plugin supplier.
