# 13.47.0

Release date: 23-09-2026

---

## New Features

### External plugins

Connect plugin packages and apps built outside Valtimo without rebuilding or redeploying the application. External plugins can add process actions, event handlers, case tabs and widgets, task forms, and menu pages — all managed from new **Plugin hosts** and **Apps** screens under **Admin > Integrations**.

For each plugin, you review and accept the permissions it requests before it can run. Valtimo enforces the accepted list at runtime, so a plugin only ever reaches the data and systems you approved. Multiple versions of a plugin can run side by side: existing cases keep using the version they were built with while new cases use a newer one.

{% hint style="info" %}
A plugin host is a separate service that runs alongside Valtimo. Ask your development team or
operator to set one up before connecting it.
{% endhint %}

See [What is an external plugin?](../../../fundamentals/external-plugins.md) for the concepts, and the [external plugins configuration guide](../../../configuration-guides/plugins/external-plugins/README.md) to start connecting and configuring plugins for a running plugin host.

### More filter options for the task count widget

A task count widget can now be limited to a single case type, and its conditions can be combined with **AND** or **OR** in groups that can be nested. Counts that previously could not be configured, such as the assigned tasks of one case type that have one of two names, now take a single widget. Existing task count widgets keep working unchanged.

### Roltypen from the Catalogi API

Two new Catalogi API plugin actions make the roltypen of a zaaktype available to a process:

- **Retrieve roltypen** stores every roltype of the zaaktype in a process variable, each with its
  URL and its description, ready to be offered in a form.
- **Retrieve roltype** stores the URL of a single roltype in a process variable. The roltype can be
  given as a description, which is looked up against the zaaktype of the case, or as a URL.

{% hint style="success" %}
The Catalogi API plugin is a ZGW plugin and can only be used in the GZAC edition.
{% endhint %}

---

## Enhancements

### The task panel in a case keeps the width you give it

The panel on the right of a case can now be dragged wider or narrower while the task list is shown, not only
while a task is open. The width you set is remembered for you across all case types and after logging in again.

### Faster startup with large case definitions

Starting the application no longer slows down as a case definition that is not final gains
processes. In a test case definition with 200 processes, startup took almost nine minutes and now
takes under a minute.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Building blocks | The breadcrumb back to a mail, text or document template overview opens that overview, instead of the building block's General tab |
| Case management | The breadcrumb back to a mail, text or document template overview opens that overview, instead of the case's General tab |
| Case management | The breadcrumb back to a case opens its General tab, instead of a page with no tab selected |
| Case types | A building block action on the Actions tab can be saved on another version |
| Startup | A case definition that is not final no longer slows startup down as it gains processes. In a test case definition with 200 processes, startup took almost nine minutes and now takes under a minute |
| SmartDocuments / Exact | These modules no longer bring their own copy of the Valtimo platform modules along, so pinning an older version of them no longer pulls an older Valtimo into the application. |

---

## Security

| Severity | Fix |
|----------|-----|
| High | A JavaScript script task in a process can no longer reach classes outside the list it is allowed to use, such as those for file, network and database access or for the process engine itself |
| High | A PostgreSQL connection that is set to require channel binding is no longer quietly allowed to fall back to a weaker protection ([CVE-2026-54291](https://nvd.nist.gov/vuln/detail/CVE-2026-54291)) |
| High | On MySQL, a user with limited rights can no longer reach data they are not allowed to see ([CVE-2026-60586](https://nvd.nist.gov/vuln/detail/CVE-2026-60586), [CVE-2026-60623](https://nvd.nist.gov/vuln/detail/CVE-2026-60623)) |

{% hint style="warning" %}
Sensitive classes such as `java.lang.System` and `java.lang.Runtime` can no longer be made
available to a script through the `valtimo.operaton.scripting.allowedClasses` setting. A script
task that uses one of them now fails and has to be rewritten, for example with
`java.time.Instant.now().toEpochMilli()` instead of `java.lang.System.currentTimeMillis()`.
{% endhint %}

### Dependency updates

Tomcat, Netty, Apache HttpClient, FreeMarker and the PostgreSQL and MySQL drivers were updated to
the versions that carry the latest security fixes. Apart from the two database driver issues
listed above, the vulnerabilities these updates close are not reachable in Valtimo.
