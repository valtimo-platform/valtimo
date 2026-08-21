# 13.43.0

Release date: 26-08-2026

---

## New Features

### Look up the active process definition keys for an entire case

`ProcessDocumentsService` now exposes `activeProcessDefinitionKeysForCase`, which returns the process definition keys of every active process instance in a case, including those of sibling documents such as building-block instances. This makes it possible to find out which processes are currently running for a case without having to query each linked document separately.

---

## Enhancements

### Case definition key and version in case inspection

The metadata tab of the case inspection page now displays the case definition key and version. This makes it clear which version of a case definition a case belongs to.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Draft environments | Default Spring profiles now correctly enable draft mode |
| Search fields | Date searches return results with correct date format |
| Document schemas | Recursive schema references no longer crash the server |
| Dashboard | Donut charts with many categories display the circle correctly |
| Case export | Forms shown in a widget are included in the case export |
