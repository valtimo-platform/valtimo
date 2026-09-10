# Plugin status and reviews

The **Plugins** page shows a status tag next to a plugin when it needs attention. Most tags are
informational, but one — **Review required** — means the plugin has stopped working and is waiting
on an administrator. This page explains each tag and what to do about it.

---

## Status tags

| Tag | Meaning | Plugin runs? |
|-----|---------|--------------|
| *(no tag)* | Normal. The plugin was discovered on its integration and its configurations are active. | Yes |
| **Review required** | The plugin package on the host changed and is no longer the package that was accepted. | **No** |
| **Awaiting host** | The configuration was declared in a deployment descriptor, but its integration has not served the plugin yet. | No, not yet |
| **Incompatible** | The plugin declares a Valtimo version range that this environment falls outside of. | Yes, but untested against this version |

On the **Apps** page, an app whose plugin has not been configured yet shows **Not configured** in
the Configuration column. Continue with [Add an app](add-an-app.md) to finish it, or
[Configure a plugin](configure-a-plugin.md) for the general activation flow.

---

## Review required

Valtimo records a fingerprint of every plugin package at the moment it is accepted. From then on,
that plugin version means exactly those contents. When an integration starts serving different
contents under the same version, Valtimo does not adopt them: it flags the plugin and stops using
it.

While a plugin is flagged:

- its actions fail, so processes that reach them stop on an error;
- its screens — case tabs, widgets, task forms, menu pages — no longer load;
- no access tokens are issued for it, and nothing is sent to the integration;
- existing configurations keep their settings and accepted permissions untouched.

Hover the tag to see which of the two situations applies:

| Situation | What it means |
|-----------|---------------|
| The package changed and requests **different permissions** | Read this one carefully. The new code wants access that nobody approved. |
| The package changed but requests **the same permissions** | The code is not the code that was accepted, even though its requested access is unchanged. |

{% hint style="danger" %}
A plugin that changes without an approved upload is exactly what this check exists to catch. Before
accepting anything, confirm with the team that operates the integration that the change was
intentional. If it was not, treat it as a security incident rather than a configuration problem.
{% endhint %}

### Resolving it

Resolution happens through the upload flow, not from the plugin's row — uploading the package is
how an administrator states which contents are approved.

{% stepper %}
{% step %}
Obtain the plugin package (`.zip`) that the integration should be serving from its supplier
{% endstep %}
{% step %}
On the **Plugins** page, click **Upload plugin** and upload that package to the integration

See [Upload a plugin](upload-a-plugin.md) for the full flow.
{% endstep %}
{% step %}
Confirm the overwrite when prompted, after reviewing the permissions the package requests

The review dialog lists the complete set — the same review as during activation.
{% endstep %}
{% endstepper %}

Confirming re-pins the package contents and re-applies the reviewed permissions to every existing
configuration of that plugin version. Within one polling cycle the tag disappears and the plugin
resumes.

{% hint style="info" %}
If the change was not intended, uploading the *original* package restores the accepted contents and
clears the flag the same way.
{% endhint %}

---

## Awaiting host

A configuration declared in a deployment descriptor exists from the moment Valtimo starts, even
before its integration has been reached. That is deliberate: process links, case tabs and menu
pages that reference the configuration resolve immediately instead of failing to import.

Until the integration serves the plugin:

- the plugin shows as unavailable and the configuration carries the **Awaiting host** tag;
- the configuration cannot be edited — its settings and permissions are not known yet. It becomes
  editable automatically once the plugin arrives;
- it can still be deleted;
- anything that actually invokes the plugin fails, which is the accurate state of the world.

No action is needed beyond making the integration reachable. Discovery completes the setup on its
own within one polling cycle — see [Manage an integration](manage-an-integration.md) if the
integration is unreachable.

---

## Incompatible

A plugin package can declare the range of Valtimo versions it supports. When the running
environment falls outside that range, the plugin keeps working but is tagged **Incompatible**, and
the tooltip names the current version alongside the range the plugin expects.

Compatibility is advice from the plugin's supplier, not a technical limit — Valtimo does not block
an incompatible plugin, at upload or afterwards. Treat the tag as a prompt to check with the
supplier whether a version matching this environment is available, particularly before relying on
the plugin in production.
