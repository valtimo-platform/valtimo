# 13.56.0

Release date: 25-11-2026

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
| Cases | Leaving a case before its tabs have loaded no longer reloads the application on the dashboard. |
| Documents | Editing Documenten API documents with status *definitief* is now allowed when the Documenten API supports it, for users with the correct [permission](/configuration-guides/access-control/configurable-elements#zgw). |
| Documents | Editing Documenten API documents with any other status is now allowed for users with the correct [permission](/configuration-guides/access-control/configurable-elements#zgw).  |
| Forms | A form that a process link uses can no longer be deleted. Making a case definition final, exporting it and creating a draft now give a clear error when a process link points to a missing form. Case definitions that are already final and contain such a link are not repaired by this change. |
| Menu | The removed **Tasks (legacy)** page is no longer offered in the menu configuration or shown in saved menus. |
| Navigation | Breadcrumbs no longer link to the current page, keep the menu section of the previous page or disappear after opening an IKO view directly. |
| Navigation | Page titles that were still shown in English when Valtimo is in Dutch are now translated. |
| Navigation | The browser tab now shows the same title as the page header on every page. |
| Plugins | Opening an external plugin page no longer leaves the header and browser tab on the previous page's title. |
