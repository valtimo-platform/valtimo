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
| Plugins | Opening an external plugin page no longer leaves the header and browser tab on the previous page's title. The page shows its menu title, follows a language switch, and shows the plugin configuration name when it has no menu item. |
| Navigation | The browser tab shows the same title as the page header, also on pages that set their own title, such as case, form and plugin pages. |
| Navigation | Breadcrumbs no longer link to the page you are on, no longer keep the menu section of the previous page, and no longer disappear after opening an IKO view directly. |
| Cases | Leaving a case before its tabs have loaded, for example through the breadcrumb, no longer reloads the application on the dashboard. |
| Navigation | Page titles that were still shown in English when Valtimo is in Dutch are now translated, such as the dashboard configuration, access control, plugin hosts, milestones and error pages. |
| Menu | The menu configuration no longer offers the removed **Tasks (legacy)** page. A saved menu that still contains it no longer shows a menu item that leads nowhere. |
| Forms | A form that a process link uses can no longer be deleted. Making a case definition final, exporting it and creating a draft now give a clear error when a process link points to a missing form. Case definitions that are already final and contain such a link are not repaired by this change. |
