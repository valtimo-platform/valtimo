# 13.52.0

Release date: 28-10-2026

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
| Forms | Clicking the submit button of a form more than once no longer submits the form multiple times; after a failed submit the button can be used again. |
