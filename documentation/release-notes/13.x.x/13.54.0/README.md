# 13.54.0

Release date: 11-11-2026

---

## New Features

### Configuration per case definition

A new Configuration tab on a case definition lets administrators declare keys with a default value, and set an environment value for each key in every environment, also on a final version and without changing the definition itself. A process reads the value through the `config:` value resolver, for example `${valueResolverDelegateService.resolveValue(execution, 'config:notificationEmail')}`; keys can also be deployed automatically from `case/configuration/<name>.case-configuration.json`, where whitelisted `${property}` placeholders are filled in at deployment, and an export carries the keys and default values but never the environment values.

---

## Enhancements

### New enhancement title

New enhancement explanation.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Dashboard | A long dashboard widget subtitle is now cut off with ellipsis instead of running out of the widget, and the full title and subtitle show on hover. |
