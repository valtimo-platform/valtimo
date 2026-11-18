# 13.55.1

Release date: 18-11-2026

---

## Bugfixes

| Area | Fix |
|------|-----|
| Forms | An IBAN or currency field with a default value now counts as filled in straight away, also when a condition shows the field or it is part of a group of fields. |
| Forms | A form that a process link uses can no longer be deleted. Making a case definition final, exporting it and creating a draft now give a clear error when a process link points to a missing form. Case definitions that are already final and contain such a link are not repaired by this change. |
