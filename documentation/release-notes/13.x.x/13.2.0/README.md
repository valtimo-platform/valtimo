# 13.2.0

{% hint style="info" %}
#### Release date 16-09-2025
{% endhint %}

## New Features

* **Clickable links in case widgets** Added a display type URL to the fields type case widget. This allows for case information to be shown in a widget as a clickable link that will open in a new tab. The text of the link can also be customized.
* It is possible to switch from task to case directly now.
* Added a way of exporting case information based on the current search results of the case list. Left of the create button, there is an export button that allows a user to download all cases that match the current search criteria. In the list column settings columns can be set to exportable. In order for the button to appear, a new `export` action on `com.ritense.document.domain.impl.JsonSchemaDocument` should be configured as a permission, and at least 1 exportable column needs to be configured for that case type.
* Each access control permission must now define an array called `actions`, instead of a single action. This makes it easier to set up the configuration and keep conditions consistent across different permissions.
* The quick search functionality has been extended to support user-specific preferences. The feature can store frequently used search queries and applied filters, making repeated searches more efficient. In addition, search results are prioritised based on recent activity and the user’s role within the system, ensuring that the most relevant items are shown first.
* The value path selector now automatically sets the document definition name from the current case.

## Bugfixes

* The migration issues from valtimo 12 to 13 where migrating forms in MySQL could cause the application to break have been fixed.
* Prevent errors on the case details page by no longer break when related process instances have been deleted (for instance by the history TTL of Camunda).
* An error where the class whitelist for use in scripting (valtimo.camunda.scripting.allowedClasses) did not get properly loaded into the scrip engine has been fixed.
* Some Dutch translations in the confirmation messages have been corrected.
* An issue with removal of Case Geometry property has been fixed.
* Empty icons show on widget config cards have been improved.
* An issue when exporting cases with no status has been resolved.
* Retrieving the username of the current user now matches exactly, rather than fuzzy.
