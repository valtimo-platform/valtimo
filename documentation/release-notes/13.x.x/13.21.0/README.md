# 13.21.0

{% hint style="info" %}
**Release date 25-03-2026**
{% endhint %}

## Migration

* [Front-end migration](./front-end-migration.md)

## New Features

* **Teams**

  Teams are groups of users in Valtimo. They can be used to organize users and manage their access to resources.
  Teams can be used for case assignment and access control rules.

  More information about teams can be found [here](../../../features/teams/README.md).

* **Team cases tab in the case list**

  When the case handler option is enabled for a case type, a new "Team cases" tab is now available in the case list.
  This tab shows all cases assigned to teams that the current user belongs to, making it easy to find work relevant
  to the user's team without filtering through all cases.

  The tab is included by default alongside the existing "All cases", "My cases", and "Unassigned cases" tabs. Which
  tabs are visible can be configured via the `visibleCaseListTabs` setting in the Angular environment file. See
  [case list tab configuration](../../../features/case/configuration.md#configuring-visible-case-list-tabs) for details.


## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* Fixed a bug where building blocks could not update the internal case status, case tags, or assignee of the calling
  case. The building block now correctly references the case definition of the parent case.

* **Replaced Carbon overflow menus with custom overflow components**

  The Carbon Design System overflow menu components have been replaced with custom-built overflow components throughout the application. The Carbon overflow menu had persistent issues with sizing, positioning, and lacked adequate support for custom panes and custom trigger elements. The new custom components resolve these limitations and provide a consistent, flexible overflow menu experience across the platform.

* **Fixed auto-deployment of global forms and object management configurations**

  Forms used by object management (edit/view forms) could not be auto-deployed in Valtimo 13 because the form importer
  required a case definition context. Global forms can now be placed in `config/global/form/*.form.json` and object
  management configurations in `config/global/object-management/*.object-management.json` for automatic pickup on
  startup.

* Fixed an issue in the migration script when upgrading from Valtimo 12. When the summary form is used for user tasks this
  will no longer cause an error when migrating.

* Fixed an issue in forms where conditions on fields that were contained in a Data Grid type field were not working 
  correctly.

