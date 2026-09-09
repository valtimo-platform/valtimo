<!--
  Copyright 2015-2026 Ritense BV, the Netherlands.
  Licensed under EUPL, Version 1.2 (the "License");
  https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
-->

# Auto-deploying external plugins

> **Audience:** implementation developers provisioning environments. For the manual flows see the
> [admin documentation](../../documentation/configuration-guides/plugins/external-plugins/README.md).

External plugins live on a **plugin host** (or are served by an **app**) rather than inside the
Valtimo backend. Getting one running normally means three manual steps in the admin UI: register
the integration, upload the plugin package, activate a configuration.

An application can declare all three instead, and Valtimo applies them at startup. This is the
external-plugin counterpart of the embedded-plugin `*.pluginconfig.json` mechanism.

## The descriptor

Create one or more files under `config/global/external-plugin/` in your resources folder, named
`*.externalplugin.json`. They are read by the same import system that handles every other global
definition, so the file works both as startup autodeployment and inside an admin-supplied import:

```json
{
  "integrations": [
    {
      "id": "0f3c9a52-9b0c-4a53-9f2a-5f7b1c2d0001",
      "name": "Plugin host",
      "kind": "PLUGIN_HOST",
      "baseUrl": "https://plugin-host.example.com",
      "secret": "${VALTIMO_EXTERNAL_PLUGIN_ADMIN_TOKEN}",
      "gzacCallbackBaseUrl": "https://valtimo.example.com",
      "eventBrokerAmqpUrl": "${VALTIMO_EXTERNAL_PLUGIN_BROKER_URL}",
      "eventBrokerExchange": "valtimo-events",
      "frontendOrigins": ["https://valtimo.example.com"],
      "packages": [
        {"resource": "classpath:config/external-plugin/my-plugin-1.0.0.zip"}
      ],
      "configurations": [
        {
          "id": "0f3c9a52-9b0c-4a53-9f2a-5f7b1c2d1001",
          "title": "My plugin",
          "pluginId": "my-plugin",
          "pluginVersion": "1.0.0",
          "properties": {
            "apiUrl": "${MY_PLUGIN_API_URL}"
          },
          "grantedCapabilities": ["gzac_api", "log"],
          "grantedEndpoints": [
            {"method": "GET", "pattern": "/api/v1/document/*"}
          ],
          "grantedEvents": ["com.ritense.valtimo.document.created"],
          "grantedEgress": ["api.example.com"]
        }
      ]
    }
  ]
}
```

Both `id` fields are UUIDs you generate once. They become the row ids, which is what makes
redeployment safe: on every later start Valtimo recognises what it already created and reconciles
only what a descriptor may change (see [Redeployment](#redeployment)). Never change a
configuration id after the first deployment — that orphans the previous row, which discovery
keeps pushing; a changed *integration* id over an unchanged `baseUrl` skips the whole entry
instead (see Redeployment).

Optional fields not shown above: integration `kind` defaults to `"PLUGIN_HOST"` — an app is
`"kind": "APP"`, serves its own plugin, and a descriptor that declares `packages` on one fails
the import; `eventQueueMode` (`"LIVE"`, the default, or `"DURABLE"`) and `eventQueueTtlMs`
(durable-mode queue TTL in milliseconds, clamped 1 h–30 d, default 72 h — leave it out for
`LIVE`); on a package, `"overwrite": true` lets the upload replace a version already installed
with **different** content (default `false`: the installed version is kept and a warning names
the conflict).

`${PROPERTY}` and `${PROPERTY:default}` placeholders are resolved against the application
environment before the file is parsed, so secrets and per-environment URLs stay out of the
repository. A placeholder with no environment value and no default is left in the file
literally — the `${…}` text becomes the stored value — so treat an unresolved placeholder in
the logs or UI as a missing environment variable.

## What happens at startup

For each integration:

1. **Register the host or app** if it does not exist yet.
2. **Activate** each declared configuration.

That is all, and none of it waits on the host — so a plugin host that is down, slow, or not started
yet never delays startup. On a first boot nothing contacts the host at all; on a redeploy of a
configuration whose plugin was already discovered, the new title and properties are pushed to the
host after the import commits, and a failed push is a warning, never a startup failure.
Configurations exist from the first boot, which is what process links, case tabs and menu pages
that reference them need.

To make step 2 possible before a host has ever been reached, Valtimo creates a **placeholder**
definition for a plugin it has not discovered yet: a row with no manifest, marked unavailable. Your
configuration attaches to it, and discovery fills the same row in later. Until then the plugin shows
as unavailable in the admin UI and nothing is sent to the host, so anything that actually invokes the
plugin fails until it is up — which is the accurate state of the world.

## What happens when the host comes up

The discovery cycle (every 60 seconds by default) finishes the job on its own, with no restart:

1. **Uploads** each declared package — once per GZAC run: a package that uploaded (or whose
   conflict or missing file was logged) is settled until the next GZAC restart, which re-offers
   it (an identical version already installed is a no-op).
2. **Fills in** the placeholder definition with the real manifest and marks the plugin available.
3. **Pushes** the configuration and a fresh service token to the host — and keeps re-pushing them
   every cycle, which is what heals a host that lost its configurations. A host that lost its
   *packages* is only healed by a GZAC restart or a UI upload.

So a descriptor-declared package lands within one discovery cycle of the host becoming reachable,
rather than instantly at startup.

## Grants

`grantedCapabilities`, `grantedEndpoints`, `grantedEvents` and `grantedEgress` must match the
plugin's manifest **exactly** — the same rule the **Permissions** step enforces. Writing them out is
deliberate: it is the point where you accept what the plugin may do, and it means a later manifest
change can never silently widen what an existing environment granted.

When the configuration was created against a placeholder, this check cannot run at creation time —
there is no manifest yet. It runs the moment one arrives instead. If the grants you declared do not
match, the plugin **stays unavailable**: nothing is pushed to the host, no service token is issued,
and an error naming the exact difference is logged. Valtimo will not quietly correct the set in
either direction, because narrowing would discard a permission you wrote down and widening would
grant one nobody accepted. Fix the descriptor, delete the affected configuration in the admin UI, and
restart.

## When you are asked to approve

Approval is only ever about the **plugin's** declared permissions, because the plugin author is the
party that isn't fully trusted. Descriptor content is yours — reviewed in git, and enforced against
the manifest at runtime — so changing it never prompts.

| What happened | Approval needed? |
|---|---|
| First deployment from a descriptor | **No.** The `granted*` arrays are the approval, and a plugin asking for anything not listed will not activate. |
| First activation through the admin UI | **Yes** — the permissions step. |
| You change `title` or `properties` in the descriptor | **No.** Applied on the next start. |
| You change an `x-egress-target` property value | **No**, though it does change what the plugin may call. The resulting origins are shown on the **Permissions** step under **External connections** as "From a URL you entered in this configuration", and the change is logged. |
| An administrator edits a configuration in the UI | **No.** Grants are untouched. |
| The plugin package on the host changes, same permissions | **Yes.** The code is no longer the code that was accepted. |
| The plugin package changes and asks for different permissions | **Yes**, and this is the one to read carefully. |
| A restart with nothing changed | **No.** No guard engages — the importer re-applies the descriptor and the discovery cycle keeps re-pushing configurations as always, but grants and pinned content are untouched, so running processes are unaffected. |

A configuration whose plugin is awaiting approval keeps its previously accepted settings and shows a
**Review required** tag; nothing is pushed to the host and no service token is issued until an
administrator accepts.

## Redeployment

Restarting is safe: rows are recognised by their descriptor ids and nothing an administrator
accepted is altered. In detail:

* `frontendOrigins` and the event-queue settings are brought in line with the descriptor.
* Descriptors never change `baseUrl`, `secret`, `gzacCallbackBaseUrl`, `kind` or the broker fields
  on an existing integration. A changed value is logged as a warning and the integration is left as
  it is; to repoint an integration — a moved host, a moved broker, a rotated admin token — use
  **Edit connection** on the integration's row in the admin UI, which validates the change and
  re-pushes every configuration.
* An active configuration is never re-granted — that set is what an administrator accepted. Its
  `title` and `properties` are brought in line with the descriptor on every start.
* An integration whose `baseUrl` is already registered under a *different* id is skipped rather than
  registered twice. To adopt descriptors in an environment where the host was added by hand, use
  that host's existing id in the descriptor (or delete it first).

## Failure handling

A descriptor that cannot be read, or an integration Valtimo refuses to register, fails the import —
the same as any other import, so a broken descriptor surfaces immediately instead of leaving an
environment silently unprovisioned.

One case does *not* fail the import: a package `resource` that cannot be found is only detected
when the host first becomes reachable — it is logged as an error and not retried, while the rest
of the descriptor deploys normally.

An unreachable host is not a failure at all: nothing was waiting on it, and the discovery cycle picks
up where the descriptor left off whenever it appears.

## Settings

| Property | Default | Meaning |
|---|---|---|
| `valtimo.external-plugin.polling.rate` | `PT60S` | How often Valtimo polls its hosts, and so how quickly a host that appears late is finished off |

## Shipping plugins with the host

The other half of a hands-off environment is the host having its packages. Besides uploading them
from a descriptor, a plugin host installs every `.zip` found in its pre-install directory when it
boots — see [Plugin host configuration & deployment](./host-configuration-and-deployment.md#shipping-plugins-with-the-host).
A version already installed with identical content is left untouched; one whose content differs is
kept rather than silently replaced.
