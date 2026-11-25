# 13.57.0

Release date: 25-11-2026

---

## Enhancements

### Case lists show which column values could not be loaded

A case list can show columns whose value is looked up from another source, for example a value from a linked zaak. When such a value cannot be loaded, the case list now still shows all of its cases: the value that could not be loaded is marked with a warning in its cell, and a notification reports that some values could not be loaded. A value that failed to load is now clearly distinct from one that is simply empty.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Case list | A case list no longer stays empty, or stuck on the loading indicator, when a column value, the status options, or a permission check cannot be loaded. The list recovers on the next filter, tab, or page change, without a full page refresh. |
