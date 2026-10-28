# 13.52.0

Release date: 28-10-2026

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
| Forms | Clicking the submit button of a form more than once no longer submits the form multiple times; after a failed submit the button can be used again. |
| Processes | A boundary error event now catches a BPMN error thrown by a plugin, also inside a building block. |

---

## Security

| Severity | Fix |
|----------|-----|
| High | The process instance search and count endpoints no longer let any logged-in user list the process instances of all cases or search their process variables. They are now only available to administrators. The search endpoints and the count by process definition name will be removed in a future version. |
| Medium | Adding a comment to a process instance is now only available to administrators, and will be removed in a future version. |
| Medium | Deploying a version of a process definition with shortened timers is now only available to administrators, and will be removed in a future version. |
