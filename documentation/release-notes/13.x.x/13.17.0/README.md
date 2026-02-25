# 13.17.0

{% hint style="info" %}
**Release date 25-02-2026**
{% endhint %}

## New Features

## Enhancements
* **Plugin configuration title in process-link modal**
   Add the selected plugin configuration title in the process-link modal to clarify which plugin configuration is used in the process-link.

## Bugfixes

* **Fixed Task due date language update**

  Fixed an issue where the task due date picker in the task detail view did not update its language when the application
  language was changed.
* **Verzoeken plugin: Available processes not loading**
  Fixed an issue where, in some cases, the Verzoeken plugin failed to load the list of available processes when there was a process without a name.

* **Fix Formio Data Source URL**

  The Formio Data Source URL now no longer contains an additional `/api`.

- Fixed an issue where the Form.io custom component **Document Picker** did not show any files.
- Fixed an issue where the Form.io custom component **Valtimo File Upload** failed to upload files.
- Fixed file uploads so they now consistently use the correct **upload process** when uploading files.

