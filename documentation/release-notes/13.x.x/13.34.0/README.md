# 13.34.0

{% hint style="info" %}
**Release date 24-06-2026**
{% endhint %}

## Bugfixes

* **Case definition could not be deleted when it contained a form flow**

  Deleting a case definition that had a form flow attached failed with an error. The only workaround was to delete the
  form flow definition first and then the case definition. Both can now be deleted in one step.
