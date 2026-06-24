# 13.34.0

{% hint style="info" %}
**Release date 24-06-2026**
{% endhint %}

## Enhancements

* **Value resolver support for Documenten API plugin**

  In the Documenten API plugin, the *store temp document* action can now resolve the confidentiality level, language and status from a value resolver expression (e.g. `pv:confidentialityLevel` or `doc:/confidentialityLevel`)
  instead of only a option op a dropdown, selectable per field via an input-type toggle. This makes all parameters resolvable which is useful in Building blocks.

## Bugfixes

* **Case definition could not be deleted when it contained a form flow**

  Deleting a case definition that had a form flow attached failed with an error. The only workaround was to delete the
  form flow definition first and then the case definition. Both can now be deleted in one step.

* **Form flows in draft case definitions could not be edited**

  Form flows in a draft case definition were incorrectly shown as read-only and can now be edited.

* **Uploading documents from a building block case**

  Fixed an issue where uploading a document from within a building block could fail to start the configured upload
  process.
