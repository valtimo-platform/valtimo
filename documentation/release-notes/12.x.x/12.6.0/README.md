# 12.6.0

## New features

#### Personal dashboards

Dashboard widgets now support filtering data based on the logged-in user, allowing for a more personalized dashboard. This functionality enables widgets to be configured to display user-specific data, such as the number of cases assigned to the logged-in user.

<figure><img src="../../../.gitbook/assets/Screenshot 2025-01-02 at 11.46.08.png" alt=""><figcaption></figcaption></figure>

For detailed instructions on configuring dashboard widgets, refer to the documentation [here](https://docs.valtimo.nl/features/dashboard/widgets).

#### Clickable dashboard widgets

Dashboards now support widgets that include click functionality. Within the widget configuration, a redirection path can be specified. When users click on the widget, they will be redirected to the configured path.&#x20;

For example, a widget displaying the number of cases matching specific criteria can be configured to redirect users to the case list page with the same filter applied.

{% hint style="warning" %}
The widget configuration should contain a path (e.g. `/dossiers/evenementenvergunning`) instead of a full URL.
{% endhint %}

#### Case widgets - text field character limit

Field widgets now include an optional setting to define the maximum number of characters displayed. This setting can be configured for each field. On the case detail page, the text is displayed up to the configured limit, with an ellipsis (`...`) appended if the text exceeds the specified length. When no character limit is configured, the full text is displayed without truncation.

Additionally, text fields now support multi-line display, eliminating the need for horizontal scrolling.

#### Delete cases

Individual cases can now be deleted directly from the case detail page. To delete a case, the user must have a permission that includes the "delete" action on the resource `com.ritense.document.domain.impl.JsonSchemaDocument`.

<figure><img src="../../../.gitbook/assets/Screenshot 2025-01-02 at 11.33.13.png" alt=""><figcaption></figcaption></figure>

For audit purposes, when a case is deleted, a cloud event of type `com.ritense.valtimo.document.deleted` is added to the outbox (if the outbox functionality is enabled).

{% hint style="danger" %}
Deleting a case should only be performed in exceptional circumstances, such as removing test data from a production environment. This action is irreversible and cannot be undone without restoring a database backup.

Carefully assess and restrict which users are granted the permission to delete cases.
{% endhint %}

#### Task subtitles

Tasks on the case detail page now support the addition of one or more subtitles. These subtitles provide the case handler with additional context about the task.

Task subtitles can be configured on the process-links page, where the user task is linked to a form or form flow:

<figure><img src="../../../.gitbook/assets/Screenshot 2025-01-02 at 11.57.34.png" alt=""><figcaption></figcaption></figure>

<figure><img src="../../../.gitbook/assets/Screenshot 2025-01-02 at 11.57.00.png" alt=""><figcaption></figcaption></figure>

#### Keycloak user cache

When processing access control permissions, multiple requests to Keycloak may be made to retrieve user data or user information. To improve performance, this information is now cached on a per-request basis, reducing the number of requests sent to Keycloak.

#### No access case detail page

When a user attempts to access a case detail page without the necessary permissions, an error page is now displayed instead of showing notifications with error messages.

<figure><img src="../../../.gitbook/assets/Screenshot 2025-01-02 at 16.21.22.png" alt="" width="375"><figcaption></figcaption></figure>

#### Access control for supporting processes based on case data

The list of supporting processes, accessible under the 'Start' menu on a case detail page, can now be filtered based on case data. Through the use of permissions, processes can be enabled only when specific case criteria are met.

#### Form.io currency component

A new currency component has been introduced to replace the default component provided by Form.io.

In the original Form.io component, the thousand separator and decimal separator did not adapt to the configured locale. The new currency component addresses this limitation by allowing the currency locale to be configured directly within the form builder.

<details>

<summary>GZAC edition</summary>

#### Configurable Documenten API metadata

When uploading a file to the Documenten API, several metadata fields have to be filled in. Per case type, these metadata fields can now be configured to:

* Have a default value
* Be readonly or editable
* Be visible or hidden

If all metadata fields are configured as hidden, the metadata modal will not be displayed. This allows the case handler to upload the file without completing a form.

Documenten API metadata fields can be configured on the case management page under the 'ZGW -> Document upload fields' tab:

<img src="../../../.gitbook/assets/Screenshot 2025-01-02 at 16.46.40.png" alt="" data-size="original">

#### Linking Zaakdetails object to the Zaak

GZAC supports syncing the document data (or Zaakdetails) to an object in the Objecten API. When creating or updating the Zaakdetails object, the object is now linked to the Zaak.

</details>

## Bugfixes

* Previously, no permission check was performed when starting a supporting process for a case. Now, users must have the "create" permission for the resource `com.ritense.valtimo.camunda.domain.CamundaExecution` to initiate a supporting process.
* Additionally, no permission check was conducted before retrieving the pre-filled start form for a supporting process. Users must now have the "view" permission for the resource `com.ritense.document.domain.impl.JsonSchemaDocument` to access the pre-filled start form.
* When the browser back-button was used on the case detail page, the user was redirected incorrectly.
* In some scenario's, task forms would be pre-filled incorrectly.&#x20;
* Form flow step definitions were duplicated during autodeployment.
* Retrieving the task list would fail when a task assignee had been removed from Keycloak.
* Correlating Camunda messages with variables using the CorrelationService now works correctly.
* The notes tab on the case detail page now supports newlines
* The Form.io builder now correctly shows the form definition after uploading a file.
* Table and collection widgets now show arrays as comma-separated lists.
* Case widgets and the case lists now show the proper boolean value for 'false', instead of a dash.
* Fixed bug where dropdown were unusable in form view model.
* A bug that prevented form view models from updating has been fixed.

<details>

<summary>GZAC edition</summary>

* On application startup, the Notificaties API plugin no longer deletes and recreates the Abonnement. Instead, when needed, the existing abonnement is updated.

</details>

## For developers

#### Autorization endpoint returns false for non existing resource

The `/v1/permissions` endpoint now returns 'false' in case of an exception, instead of returning HTTP status 500.

#### Changeset module supports config changes

The changeset module now supports changes in the structure of autodeployment files. This way, new functionality can be added to existing autodeployment files without having to migrate existing changeset database records.\
It is possible dashboard autodeployment files that have previously been deployed result in new checksums. As a one-time fix, these checksums should be updated manually in the `valtimo_changelog` table in the database.

#### Form view model support for Form.io wizard

The form view model feature now supports page numbers, enabling Form.io wizards to use this module as well.

#### Dashboard modules (frontend)

Two new dashboard Angular modules have been added:

* DataSourcesModule includes all datasource-specific modules
* DisplayWidgetTypesModule includes all widget-type specific modules

Including these modules in the `app.module.ts` file eliminates the need to import individual modules manually and ensures that any new modules added in the future are automatically included.

















