
# 13.3.0



{% hint style="info" %}
**Release date 08-10-2025**
{% endhint %}

## New Features

* **Add Case Objects to Case** &#x20;

A new plugin action has been added to the Zaken API Plugin, allowing users to create a case object directly within a process. This feature can be used whenever someone needs to link an existing  object to a case.

* **Enhanced “Create Case” Plugin Action**&#x20;

The “Create Case” plugin action has been improved to allow users to fill in more case details when creating a new case in Open Zaak. Previously, only the required fields were included when a case was created. With this update, additional (optional) fields can now be completed, making it easier to register cases with all the relevant information right from the start.

* **Conditially display widgets**

Case widgets can now be conditionally displayed based on information in the case. A number of conditions can be configured
for each case widgets, that the case has to meet in order for the widget to be shown. This allows for a cleaner widget page
as widgets can be hidden that don't apply to the current case.

## Bugfixes

* Case widgets of type FormIO will now correctly finish loading and no longer cause the widget
  page to be stuck on a loading animation.
* The document files endpoint in the Documents tab is now called only once, improving performance and preventing duplicate requests when many documents are linked to a case.
* The task status shown in the case details is now fully visible, ensuring the status text is no longer partially cut off.
* Cases can now be opened when the underlying process has been deleted.
* Fixed an issue where the Verzoek plugin could not be migrated correctly which caused the
  `VerzoekProperties["caseDefinitionKey"]` to be `NULL`.
* Verzoek plugin no longer throws error on startup when case-definition has not been imported yet.
