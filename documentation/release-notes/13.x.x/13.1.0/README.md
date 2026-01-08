# 13.1.0

## New Features

#### Access Control for Case Definition

Valtimo 13.1.0 introduces a different way to permit certain actions related to case definitions. 
This enables fine-grained control over when a user is allowed to see a case definition.

#### Case definition list columns and search fields

List columns and search fields can now be configured via a JSON Editor under the Case definition details.

#### Dashboards widget configuration

Dashboard widget configurations can now be edited via a JSON Editor under the dashboard details.

#### Notificaties API improvements

When working with the Notificaties API, it is important to keep subscriptions (abonnementen) as specific as possible. 
Otherwise, the Notificaties API will send more messages than Valtimo is interested in, leading to more stress on both
systems.

Valtimo more accurately determines which channels (kanalen) should be subscribed to, with accompanying filters to reduce this
stress as much as possible. This is done by evaluating plugin configurations that depend on the Notificaties API, such
as the Portaaltaak plugin and the Verzoek plugin. Lastly, all channels that are subscribed to are combined into a
single subscription.

#### Form.io translation mechanism

A new way to translate Form.io forms has been introduced. When following the instructions [on this page](../../../features/forms/README.md),
forms rendered inside the application will be translated automatically, making use of the current application language
and the translation resources configured in the application.

<details>

<summary>GZAC edition</summary>

#### New Zaken API plugin actions

New actions have been added to the Zaken API plugin:

##### Patch zaak

The Patch zaak action allows partial updates to a Zaak. Only the fields that are set while configuring the action 
will be updated.

##### New create zaakrol types

New actions were added to create a <em>ZaakRol</em> of different types. Before it was possible to create a 
<em>ZaakRol</em> where the type of <em>betrokkene</em> was `natuurlijk_persoon` and `niet_natuurlijk_persoon` only. 
The following actions were added to create a <em>ZaakRol</em> of the respective type:
- Create zaakrol - employee (for `medewerker`)
- Create zaakrol - organizational unit (for `organisatorische_eenheid`)
- Create zaakrol - branch (for `vestiging`)

</details>

## Enhancements

#### Task subtitles

The subtitle of a task is now also displayed to users that do not have permission to view the task itself.

#### Docker Compose support for local development

Improved support for running Valtimo locally using Docker Compose. Configuring references to localhost will no 
longer break when running other related ZGW services in Docker containers.

#### Improved context support in access control

Added a NoContext option to the access control configuration. This allows for configuring access control for instances 
where no context is provided. For example, when starting a supporting process, the case is provided as context. However, 
when starting a case, no context is provided. With the NoContext option, it is now possible to configure access control
for starting a case, without giving users permissions for starting any supporting processes.

#### Sorted object types in the main menu

Object types in the main menu when using object management are now sorted alphabetically by name.

## Bugfixes 

* Forms using the documenten-api-file upload component now correctly allow submission when it is the only required field, and no longer enable the submit button when other required fields are incomplete.

* Form definitions table now consistently shows Dutch and German translations in the readonly column instead of sometimes falling back to English.
  
* Fixed an issue where forms with the “documenten-api-file” component didn't correctly handle required fields, ensuring the Submit button only enables when all required inputs are completed.

* When uploading documents in the document tab of a case, the status field is now prefilled with the value configured in the 
field configuration.

* Fixed an issue where the document URL from the Documents API was not available for config-only setups, preventing decision documents from being linked to Decisions.
