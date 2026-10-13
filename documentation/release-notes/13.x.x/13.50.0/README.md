# 13.50.0

Release date: 14-10-2026

{% hint style="warning" %}
This release contains security fixes. See [Security](#security) for details.
{% endhint %}

---

## New Features

### New feature title

New feature explanation.

---

## Enhancements

### New enhancement title

New enhancement explanation.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Area name | New bugfix. |

---

## Security

| Severity | Fix |
|----------|-----|
| Medium | The dropdown list and translation data endpoints no longer let a logged-in user read JSON files outside the `config/dropdown` and `config/translation` folders, such as plugin configurations or permission files, by putting `../` in the requested key |
| Medium | The case widget endpoints (widget tab, widget data and grouped widget data) now require `view` permission on the case itself (`JsonSchemaDocument`), in addition to the case tab and widget permissions. |
| Medium | The zaak endpoints, zaak files endpoints, the zaak object endpoints, the external plugin tab, the case tabs of a case, the process links of a case and the process timer endpoints now require `view` permission on the case. |
| Medium | Several process-related endpoints now have additional access control. The process diagram shown in the case **Progress** tab and in **Case Inspection** now requires permission on the case |
