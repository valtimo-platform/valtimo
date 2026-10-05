# 13.49.0

Release date: 07-10-2026

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
| Form flows | A form flow that has been used can now be deleted from a draft case definition or building block, as can the draft case definition itself; its form flow instances are deleted along with it |
