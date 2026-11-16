# 13.55.0

Release date: 18-11-2026

---

## New Features

### New feature title

New feature explanation.

---

## Enhancements

### New enhancement title

New enhancement explanation.

### Editable dashboard key

When you create a dashboard, you can now edit its key, as elsewhere in the application.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Case management | The start menu for supporting processes on a case now updates when the internal status of the case changes. |
| Case management | Drag-and-drop reordering of case tabs, widgets and other lists now works in Safari. |
| Dashboard | Dashboards and widgets with a name without letters, such as `2026`, now get a valid key. |
| Dashboard | Dashboards and widgets that were saved with an empty key can be opened, edited and deleted again. |

{% hint style="warning" %}
Dashboards and widgets with an empty key get a new key when you upgrade, such as `dashboard_2026` or `widget_2026`. Update any access control conditions or autodeploy files that refer to the empty key.
{% endhint %}
