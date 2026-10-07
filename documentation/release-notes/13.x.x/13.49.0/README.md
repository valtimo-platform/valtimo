# 13.49.0

Release date: 07-10-2026

---

## New Features

### Building block migration wizard

Building block versions no longer have to be traced and updated by hand. The **Migrate** button on the
building block list opens a wizard that moves every reference to one building block version onto
another version of the same building block — newer or older.

- **Where it is used** — only versions that are actually referenced can be chosen, and each reference
  is shown with its full path, up to and including the case definition version: a call activity in a
  case or in another building block at any depth, or a building block on a case's Actions tab.
- **What it changes** — references that live entirely in drafts are migrated in place. References
  that pass through finalized versions can be opted in: the wizard then creates the drafts needed along
  the way, based on exactly the versions referenced, and points each of them to the next. A container
  that already has an open draft gets no second one; the change goes into that draft instead.
- **What differs** — new required inputs, mappings to fields the target no longer has, and plugins the
  target needs are listed per reference and resolved in the wizard before anything runs.

The migration runs as a single transaction and only ever writes to drafts. It never finalizes anything
and never touches running cases: review and finalize the drafts afterwards, then plan a case migration
to move running cases.

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
