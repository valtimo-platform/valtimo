# 13.55.0

Release date: 18-11-2026

---

## New Features

### Contracts between external plugins

External plugins can now work together. One plugin can offer a service, such as generating a letter or looking up a registration, and another plugin can use it. Plugins never talk to each other directly: every request goes through Valtimo, and you decide which plugin configuration answers it.

- When you configure or edit a plugin that uses other plugins, the **Permissions & plugins** step lists the contracts it calls. Choose the plugin configuration that answers each contract, or leave it unbound. A request to an unbound contract fails.
- The same step shows which contracts a plugin offers to other plugins.
- When a new plugin version calls a new contract, accepting it binds that contract automatically only where exactly one configuration provides it. Everywhere else, bind it yourself.
- Requests that take longer are tracked as contract jobs. The new **Contract jobs** page under **Admin > Integrations** shows their status. From there you can cancel a job that is still running, stop delivering a reply, or deliver a reply again.
- Opening the request and result of a job is recorded in the audit log, because they can contain personal data.
- A plugin configuration cannot be deleted while another configuration is bound to it, or while it has an open contract job.
- Contracts need plugin host 1.1.0. Plugins that use contracts are built with plugin SDK 1.1.0.

More information: [Contracts between plugins](../../../configuration-guides/plugins/external-plugins/contracts.md).

---

## Enhancements

### External plugin screens can open a case page

A screen of an external plugin can now open a case page, for example through a **Dossier** button in a side panel. The page only opens after the user clicks in the plugin screen, and the usual permissions of the case page apply.

### Plugin settings screens fit their content

The settings screen of an external plugin now grows with its content when you edit a plugin configuration or configure a plugin action in a process, just like it already did when you configure a new plugin.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Case management | The start menu for supporting processes on a case now updates when the internal status of the case changes. |
| Case management | Drag-and-drop reordering of case tabs, widgets and other lists now works in Safari. |
