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
| IKO | A widget or search result list that could not retrieve its data now says so and offers a retry |
| Building blocks | A final building block can be deployed to an environment that does not allow drafts, such as production |
| Form flows | A form flow that has been used can now be deleted from a draft case definition or building block, as can the draft case definition itself; its form flow instances are deleted along with it |
| Case list | The case list now loads even when a ZGW API fails to return data for a case, for example when the zaak is confidential and GZAC is not authorized to view it; the affected columns stay empty and all other data is still shown |
| Cases | A form opened in the side panel of a case stays open and keeps its contents when switching between the case's tabs |
| Cases | A start form configured to open in the side panel now opens there on every case tab, including tabs without a task list, instead of opening in a modal |
| Platform | The application stays stable when users reload or close their browser, instead of slowly running out of memory |
| Platform | A user with a slow or lost connection no longer delays the processing of cases and tasks for other users |
| Platform | A user closing their browser while a page is loading no longer shows up as an error in the application logs |
