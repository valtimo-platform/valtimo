# 13.53.0

Release date: 04-11-2026

---

## New Features

### Configuration per case definition

A new Configuration tab on a case definition lets administrators declare keys with a default value, and set an environment value for each key in every environment, also on a final version and without changing the definition itself. A process reads the value through the `config:` value resolver, for example `${valueResolverDelegateService.resolveValue(execution, 'config:notificationEmail')}`; keys can also be deployed automatically from `case/configuration/<name>.case-configuration.json`, where whitelisted `${property}` placeholders are filled in at deployment, and an export carries the keys and default values but never the environment values.

---

## Enhancements

### Hide document actions that aren't available

Row actions in the case document list can now be hidden entirely instead of only shown disabled,
and plugins can contribute their own actions to that list. The **Preview** action is hidden
rather than shown disabled when no preview plugin is configured for the document's Documenten API.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Widgets | A widget display condition with a number value, such as `0`, now compares numerically against a number field. The `${0}` workaround is no longer needed. |
| Process editor | Expression fields in the BPMN editor now remember the Manual mode after saving, and chained expressions open in Manual mode instead of the Dropdown. |
