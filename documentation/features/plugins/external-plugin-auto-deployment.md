# Auto-deploying external plugins

External plugins live on a **plugin host** (or are served by an **app**) rather than inside the
Valtimo backend. Getting one running normally means three manual steps in `Admin → Integrations`:
register the host, upload the plugin package, activate a configuration.

An application can declare all three instead, and Valtimo applies them at startup. This is the
external-plugin counterpart of the embedded-plugin `*.pluginconfig.json` mechanism described in
[Configuring plugins](configure-plugin.md).

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
redeployment safe: on every later start Valtimo recognises what it already created and leaves it
alone. Never change an id after the first deployment — that orphans the previous row.

`${PROPERTY}` and `${PROPERTY:default}` placeholders are resolved against the application
environment before the file is parsed, so secrets and per-environment URLs stay out of the
repository.

## What happens at startup

For each integration:

1. **Register the host or app** if it does not exist yet.
2. **Activate** each declared configuration.

That is all, and none of it contacts the host — so a plugin host that is down, slow, or not started
yet never delays startup. Configurations exist from the first boot, which is what process links,
case tabs and menu pages that reference them need.

To make step 2 possible before a host has ever been reached, Valtimo creates a **placeholder**
definition for a plugin it has not discovered yet: a row with no manifest, marked unavailable. Your
configuration attaches to it, and discovery fills the same row in later. Until then the plugin shows
as unavailable in the admin UI and nothing is sent to the host, so anything that actually invokes the
plugin fails until it is up — which is the accurate state of the world.

## What happens when the host comes up

The discovery cycle (every 60 seconds by default) finishes the job on its own, with no restart:

1. **Uploads** each declared package. Apps serve their own plugin and accept no packages.
2. **Fills in** the placeholder definition with the real manifest and marks the plugin available.
3. **Pushes** the configuration and a fresh service token to the host.

So a descriptor-declared package lands within one discovery cycle of the host becoming reachable,
rather than instantly at startup.

## Grants

`grantedCapabilities`, `grantedEndpoints`, `grantedEvents` and `grantedEgress` must match the
plugin's manifest **exactly** — the same rule the activation screen enforces. Writing them out is
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
| You change an `x-egress-target` property value | **No**, though it does change what the plugin may call. The resulting origins are shown as "derived egress" on the permissions step, and the change is logged. |
| An administrator edits a configuration in the UI | **No.** Grants are untouched. |
| The plugin package on the host changes, same permissions | **Yes.** The code is no longer the code that was accepted. |
| The plugin package changes and asks for different permissions | **Yes**, and this is the one to read carefully. |
| A restart with nothing changed | **No.** Nothing is re-pushed and no guard engages, so running processes are unaffected. |

A configuration whose plugin is awaiting approval keeps its previously accepted settings and shows a
**Review required** tag; nothing is pushed to the host and no service token is issued until an
administrator accepts.

## Redeployment

Restarting changes nothing. Beyond that:

* The whole connection surface — `name`, `baseUrl`, `secret`, `gzacCallbackBaseUrl`, the broker
  fields, the event-queue settings and `frontendOrigins` — is brought in line with the descriptor.
  Repointing an integration at a moved host or broker is therefore just an edit to the descriptor;
  the configurations under it keep their ids, properties and granted permissions.
* A redeployment that changes the address or the credentials **revokes the tokens** of every
  configuration under the integration: from that moment Valtimo no longer talks to the old address,
  so anything still running there must be assumed hostile. The next discovery cycle hands the new
  address a fresh token, so a legitimate host recovers on its own, and the configurations left
  behind on the old address are removed best-effort. The repoint is logged at INFO. A redeployment
  that changes nothing revokes nothing.
* `kind` is **immutable**: an app serves its own plugin while a plugin host accepts uploads, so
  switching would change the upload model and the definition set. A changed `kind` is logged as a
  warning and left as it is; delete the integration and let it be registered again to change it.
* Broker credentials can never be moved onto an address Valtimo can only reach over plaintext HTTP.
  The configuration push carries them in its body, so the transport check runs on every resulting
  state, not just at registration — a descriptor that downgrades `baseUrl` to plain HTTP while a
  broker is configured fails the import.
* An active configuration is never re-granted or re-titled — that set is what an administrator
  accepted.
* An integration whose `baseUrl` is already registered under a *different* id is skipped rather than
  registered twice. To adopt descriptors in an environment where the host was added by hand, use
  that host's existing id in the descriptor (or delete it first).

## Failure handling

A descriptor that cannot be read, or an integration Valtimo refuses to register, fails the import —
the same as any other import, so a broken descriptor surfaces immediately instead of leaving an
environment silently unprovisioned.

An unreachable host is not a failure at all: nothing was waiting on it, and the discovery cycle picks
up where the descriptor left off whenever it appears.

## Settings

| Property | Default | Meaning |
|---|---|---|
| `valtimo.external-plugin.polling.rate` | `PT60S` | How often Valtimo polls its hosts, and so how quickly a host that appears late is finished off |

## Shipping plugins with the host

The other half of a hands-off environment is the host having its packages. Besides uploading them
from a descriptor, a plugin host installs every `.zip` found in its pre-install directory
(`PLUGIN_PREINSTALL_DIR`, `/data/preinstalled` in the container image) when it boots. Mount a
directory of packages over it, or bake them into a derived image. A version already installed with
identical content is left untouched; one whose content differs is kept rather than silently
replaced.
