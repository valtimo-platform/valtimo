# 13.49.0

Release date: 07-10-2026

---

## New Features

### Update building block usages

Building block versions no longer have to be traced and updated by hand. The **Update usages** button on the
building block list opens a wizard that moves every reference to one building block version onto
another version — newer or older — of the same building block, or onto another building block.

**[Try it out →](../../../configuration-guides/building-blocks/usage-update.md)**

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
