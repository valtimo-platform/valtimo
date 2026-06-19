# 13.34.0

{% hint style="info" %}
**Release date 24-06-2026**
{% endhint %}

## New Features

* **Catalogi API plugin action: Get Informatieobjecttype**

  A new plugin action `get-informatieobjecttype` has been added to the Catalogi API plugin. This action retrieves an 
  informatie object type URL from the Catalogi API and stores it in a process variable.
  
  This is useful when you need to dynamically resolve an informatieobjecttype URL during process execution.

## Enhancements

## Bugfixes

* **Case definition could not be deleted when it contained a form flow**

  Deleting a case definition that had a form flow attached failed with an error. The only workaround was to delete the
  form flow definition first and then the case definition. Both can now be deleted in one step.

* **Form flows in draft case definitions could not be edited**

  Form flows in a draft case definition were incorrectly shown as read-only and can now be edited.

* **Uploading documents from a building block case**

  Fixed an issue where uploading a document from within a building block could fail to start the configured upload
  process.
