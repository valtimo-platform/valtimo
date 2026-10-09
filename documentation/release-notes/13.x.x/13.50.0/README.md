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
| Forms | Clicking the submit button of a form more than once no longer submits the form multiple times; after a failed submit the button can be used again |

---

## Security

| Severity | Fix |
|----------|-----|
| Medium | The dropdown list and translation data endpoints no longer let a logged-in user read JSON files outside the `config/dropdown` and `config/translation` folders, such as plugin configurations or permission files, by putting `../` in the requested key |
