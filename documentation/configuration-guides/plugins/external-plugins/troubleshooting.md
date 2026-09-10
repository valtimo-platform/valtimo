# Troubleshooting external plugins

External plugins depend on a service outside Valtimo, so most problems are connection or
permission problems rather than configuration mistakes. This page starts from what you can see and
points at the fix.

Because Valtimo re-checks every integration on a fixed interval (one minute by default), a good
first step for anything intermittent is simply to wait one cycle and refresh: an integration that
was briefly unavailable recovers on its own, without any manual step.

---

## Find the symptom

| What you see | Most likely cause | Where to go |
|--------------|-------------------|-------------|
| An integration shows **Unreachable** | Wrong base URL, a rotated secret, or the service is down | [Integration is unreachable](#integration-is-unreachable) |
| A plugin shows **Review required** | Its package on the host changed and is no longer the accepted one | [Plugin status and reviews](plugin-status-and-reviews.md#review-required) |
| A plugin shows **Awaiting host** | Declared by a deployment descriptor; its integration has not served it yet | [Plugin status and reviews](plugin-status-and-reviews.md#awaiting-host) |
| A plugin shows **Incompatible** | The plugin declares a Valtimo version range this environment falls outside | [Plugin status and reviews](plugin-status-and-reviews.md#incompatible) |
| A case tab, widget or page is blank or shows unavailable | The frontend origin is not allowed, or the plugin is suspended | [A plugin screen does not load](#a-plugin-screen-does-not-load) |
| A process stops on a service task with a plugin error | The action failed, or the integration is unreachable | [An action fails in a process](#an-action-fails-in-a-process) |
| The plugin's settings step shows a JSON text area | The plugin ships no configuration form | [The settings step asks for JSON](#the-settings-step-asks-for-json) |
| A configuration cannot be deleted | Something still references it | [Manage an integration](manage-an-integration.md#deleting-configurations-and-integrations) |
| An upload is refused | Invalid package, too large, or the version exists with different contents | [An upload is refused](#an-upload-is-refused) |
| An app cannot be connected | Wrong details, the app is not ready, or its plugin is already registered | [An app cannot be connected](#an-app-cannot-be-connected) |
| The plugin runs but does the wrong thing | A plugin-side problem | [Plugin logs](plugin-logs.md) |

---

## Integration is unreachable

**Unreachable** means repeated check-ins failed. Configurations, process links and tabs stay in
place and recover automatically once the integration answers again.

Work through, in order:

{% stepper %}
{% step %}
Confirm with the team operating the integration that the service is running
{% endstep %}
{% step %}
Check the **Base URL** on the integration's row — open **Edit connection** to see it

Valtimo must be able to reach that address. Between containers or networks, the address that works
from your browser is often not the address that works from Valtimo.
{% endstep %}
{% step %}
If the secret was rotated, set the new value under **Edit connection**

Rotation is two-sided: the integration must be restarted with the matching token, and Valtimo must
be given the same value. Until both sides agree, the status stays Unreachable.
{% endstep %}
{% endstepper %}

{% hint style="info" %}
Everything recovers on the first successful check-in after both sides match — there is nothing to
re-activate and no configuration to rebuild.
{% endhint %}

---

## A plugin screen does not load

Plugin screens render inside a locked-down frame, and two things commonly stop them.

**The frontend origin is not allowed.** Every URL users open the Valtimo frontend from must be
listed under the integration's **Allowed frontend origins**, including reverse-proxy aliases. With
no origins listed, no page can embed that integration's screens — see
[Manage an integration](manage-an-integration.md#frontend-origins). After a change to origins or to
the base URL, the page asks for a reload; the policy that permits embedding is applied when the
page loads.

**The plugin is suspended.** A plugin tagged **Review required** serves no screens at all until an
administrator resolves it — see
[Plugin status and reviews](plugin-status-and-reviews.md#review-required).

If neither applies, check that the user is allowed to see the tab or widget at all: access to case
tabs and widgets is governed by the standard access control rules — see
[External plugins in cases and processes](external-plugins-in-cases-and-processes.md#access-control).

---

## An action fails in a process

A failing plugin action surfaces as a process error on the service task, like any other failing
action. The distinction that matters is whether the plugin ran:

| Error | Meaning | Next step |
|-------|---------|-----------|
| The integration is unreachable | The action never ran | [Integration is unreachable](#integration-is-unreachable) |
| The plugin is awaiting review | The action was refused before running | [Review required](plugin-status-and-reviews.md#review-required) |
| An error from the plugin itself | The plugin ran and reported a failure | [Plugin logs](plugin-logs.md) |

Retry the activity once the cause is resolved; nothing about the process link needs to be rebuilt.

---

## The settings step asks for JSON

When a plugin ships its own configuration form, the **Enter data** step is that form. When it does
not, Valtimo cannot invent one, so the step shows a **Properties (JSON)** text area instead and the
settings have to be entered as JSON.

Ask the plugin's supplier for the property names, types and an example — or, preferably, for a
version that ships a configuration form. The same applies to an action's inputs in the process-link
modeler. See [Configure a plugin](configure-a-plugin.md#plugins-without-a-settings-form).

---

## An upload is refused

| Message | Cause |
|---------|-------|
| The plugin host rejected the upload | The package is invalid — a broken manifest, disallowed contents, or oversized files inside it |
| Package too large | The package exceeds the accepted size (100 MB by default). The message names the package's size and the limit |
| Already up to date | Not an error: this exact package is already installed, so there is nothing to overwrite |
| This version exists with different contents | A version is never replaced silently. Review the requested permissions and confirm the overwrite |

Package rules are the plugin developer's concern. For an invalid package, send the message to the
plugin's supplier rather than trying to repackage it. See [Upload a plugin](upload-a-plugin.md).

---

## An app cannot be connected

| Message | Cause and fix |
|---------|---------------|
| The app could not be connected | Wrong base URL or secret, or the app is not running. Correct the details and use **Retry** |
| App added, but not ready yet | The app was saved but did not serve its plugin in time. Valtimo finishes the job automatically once the app is reachable; the configuration can be completed later from the Apps page |
| App already registered | The plugin this app provides is already registered by another integration. Connect an app only once, or remove the existing registration first |
| Refresh required | Expected. The page reloads so that the security policy for the new app's screens is applied |
