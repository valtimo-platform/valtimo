# Add a plugin host

A plugin host is a service that stores plugin packages and runs them in a sandbox. Adding one
connects it to Valtimo: from then on Valtimo discovers the plugins it serves, and administrators
can upload packages to it and activate configurations.

Adding a plugin host requires an administrator role, and two details from the team operating the
host:

| Detail | Description |
|--------|-------------|
| Base URL | The URL where Valtimo can reach the host (for example `https://plugin-host.internal:8090`). |
| Secret | The host's admin token. Valtimo uses it to sign every request to the host, so the value must match the one the host was started with. |

---

## Adding a plugin host

{% stepper %}
{% step %}
Expand **Admin** in the left sidebar and click **Plugin hosts**
{% endstep %}
{% step %}
Click **Add plugin host**
{% endstep %}
{% step %}
Fill in the connection details

<figure><img src="../../../assets/configuration-guides/plugins/external-plugins/02-add-plugin-host-modal.png" alt=""><figcaption>Add plugin host</figcaption></figure>
{% endstep %}
{% step %}
Click **Save**
{% endstep %}
{% step %}
In the **Reload required** dialog, click **Reload now**

Configuring plugins from the new host shows screens the host serves, which the page's security
policy only allows after a reload. **Later** postpones the reload — the host itself is already
saved.
{% endstep %}
{% endstepper %}

### What you fill in

| Property | Description |
|----------|-------------|
| Name | Display name for this host. |
| Base URL | URL where Valtimo reaches the host. |
| Secret | The host's admin token. Stored encrypted; never shown again. |
| Allowed frontend origins | The browser origins (`scheme://host[:port]`, no path) allowed to embed this host's plugin screens. Add every URL users open the Valtimo frontend from, including proxy aliases. With no origins listed, no page can embed this host's plugin screens. |

### Pre-filled — change only when told to

These are filled in with values that are correct for a standard environment. Change them only on
instruction from the team operating the host or the platform.

| Property | Description |
|----------|-------------|
| GZAC callback URL | The URL plugins on this host use to call back into this Valtimo environment. Change it when the host reaches Valtimo on a different address than the default — for example when the two run in separate containers. |
| Event broker URL (optional) | The message broker (AMQP) address plugins receive events from. Pre-filled from the platform's own broker with the credentials masked as `***` — leaving the masked value in place uses the platform credentials. Leave empty to disable events for this host. |
| Event broker exchange (optional) | The exchange events are read from. The pre-filled default matches what Valtimo publishes to. |
| Event queue mode | **Live** — events published while the host is down are lost. **Durable** — events are retained for a configurable time while the host is down, and delivered when it returns. Durable mode asks for an inactivity time-to-live, entered in milliseconds (default 72 hours, between 1 hour and 30 days). Also changeable later — see [Manage an integration](manage-an-integration.md#event-queue-settings). |

{% hint style="warning" %}
The base URL must use HTTPS (or point at localhost during development). Everything Valtimo sends
the host with a configuration — an access token, the plugin's secret settings, any event broker
credentials — travels over that connection, so a plain-HTTP remote address is refused. Deployments
on a fully trusted network can lift this with an operator setting.
{% endhint %}

{% hint style="info" %}
If a value is rejected — a plain-HTTP remote base URL, an address Valtimo cannot dial, or an
address outside the allowed list when the deployment restricts plugin host addresses — the reason
appears inside the form and nothing you typed is lost.
{% endhint %}

After saving, the host appears in the list. Within one polling cycle its status becomes
**Connected** and its plugins appear when [configuring a plugin](configure-a-plugin.md). Continue
with [uploading a plugin](upload-a-plugin.md) if the host does not have its packages yet.

---

## Ways to provision without clicks

Plugin hosts and their plugins can also be provisioned automatically:

- The host installs every plugin package found in its pre-install folder at startup.
- An application can declare its integrations, packages, and configurations in a deployment
  descriptor that Valtimo applies at startup.

Both are set up by developers or operators rather than from the admin interface, so ask your
development team if an environment should be provisioned this way. A configuration created from a
deployment descriptor is visible here like any other, and carries an **Awaiting host** tag until
its integration serves the plugin — see
[Plugin status and reviews](plugin-status-and-reviews.md#awaiting-host).
