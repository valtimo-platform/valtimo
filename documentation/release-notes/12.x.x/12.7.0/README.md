# 12.7.0

## New features

#### Task data on dashboard

&#x20;A new data source has been added to the dashboard widgets: the number of tasks can now be displayed as a 'big number' or in a gauge. With the [personal dashboard filters](https://docs.valtimo.nl/release-notes/12.x.x/12.6.0#personal-dashboards) introduced in version 12.6, widgets can also display the number of tasks assigned specifically to the logged-in user.&#x20;

<figure><img src="../../../.gitbook/assets/Screenshot 2025-01-22 at 07.53.03.png" alt=""><figcaption></figcaption></figure>

<div align="left"><figure><img src="../../../.gitbook/assets/Screenshot 2025-01-22 at 07.53.21.png" alt="" width="273"><figcaption></figcaption></figure></div>

#### Start supporting process on a case widget

Case widgets now support the configuration of a button to open a supporting process. With this configuration, case handlers can start a process directly related to the content of the widget. The configured button is only visible when the logged-in user has the required access control permissions.

#### Value path selector

To simplify case configuration, the 'value path selector' has been added to the dashboard widget configuration. This feature allows users to select case properties directly, eliminating the need to manually type a JsonPath and reducing the risk of typos and misconfigurations.

{% hint style="info" %}
In version 12.7, the value path selector is only available for case-related datasources.
{% endhint %}

#### Duplicate widgets

Both case widgets and dashboard widgets can now be duplicated. This enhancement allows users to quickly create multiple similar widgets by duplicating an existing one and adjusting its configuration.

<details>

<summary>GZAC edition</summary>

#### Value path selector in Verzoek, Portaaltaak and SmartDocuments

To make plugin configuration easier, the value path selector has been added to the following plugins:

* Verzoek
* Portaaltaak
* SmartDocuments

#### Verzoek mapping now accepts "object" prefix

Using the `object` prefix, properties from the root of the Verzoek object can now be configured in the Verzoek type mapping. Example: `object:type` resolves to the objecttype URL.

</details>

## Bugfixes

* A process link type (e.g. form, form flow or plugin) could not be changed using autodeployment files.&#x20;
* A user with `view_list` permissions for a task, but without `view` permissions would get an error on the case detail page.













