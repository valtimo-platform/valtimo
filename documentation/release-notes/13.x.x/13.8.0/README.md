# 13.8.0

{% hint style="info" %}
**Release date 17-12-2025**
{% endhint %}

## New Features

* **Setting case properties from within a form**

You can now update a limited set of `case:` properties directly from a Form.io form by using the **Form.io Custom
Property** `targetKey`. The supported `targetKey` values:

- `case:assigneeId` — updates the case assignee
- `case:internalStatus` — updates the case internal status
- `case:caseTags` — adds a tag to the case

Only the keys listed above are supported. Setting `targetKey` to any other `case:` property is **not supported** and
will still result in an error.

## Bugfixes

* Resolved issue where during deployment of process-links the wrong process version is looked up.
* Resolved issue where the translations in the plugin action 'Get Resultaattypen' configuration page of plugin 'Catalogi API' were not displayed correctly.
