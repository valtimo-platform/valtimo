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
| Access control | When access is checked for a user who has been removed from Keycloak, the application log now says the user could not be found, instead of refusing without saying why |
| Processes | A process step that assigns the case to a user who has been removed from Keycloak no longer stops the process; the case keeps its current assignee and the log says the user could not be found |

---

## Security

| Severity | Fix |
|----------|-----|
| Medium | The dropdown list and translation data endpoints no longer let a logged-in user read JSON files outside the `config/dropdown` and `config/translation` folders, such as plugin configurations or permission files, by putting `../` in the requested key |
