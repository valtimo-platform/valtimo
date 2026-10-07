# 13.49.0

Release date: 07-10-2026

{% hint style="info" %}
This release contains security fixes. See the [Security](#security) section below.
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
| IKO | A widget or search result list that could not retrieve its data now says so and offers a retry |
| Building blocks | A final building block can be deployed to an environment that does not allow drafts, such as production |
| Form flows | A form flow that has been used can now be deleted from a draft case definition or building block, as can the draft case definition itself; its form flow instances are deleted along with it |

---

## Security

| Severity | Fix |
|----------|-----|
| Medium | The case widget endpoints (widget tab, widget data and grouped widget data) now require `view` permission on the case itself (`JsonSchemaDocument`), in addition to the case tab and widget permissions. |
| Medium | The zaak endpoints, zaak files endpoints, the zaak object endpoints, the external plugin tab, the case tabs of a case, the process links of a case and the process timer endpoints now require `view` permission on the case. |
| Medium | Several process-related endpoints now have additional access control. The process diagram shown in the case **Progress** tab and in **Case Inspection** now requires permission on the case |