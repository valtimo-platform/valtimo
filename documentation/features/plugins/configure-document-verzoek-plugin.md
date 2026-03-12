# Document Verzoek Plugin

{% hint style="success" %}
The Document Verzoek plugin is a ZGW plugin and can only be used in the GZAC edition.
{% endhint %}

The Document Verzoek plugin is used to notify a case handler (zaakbehandelaar) that a new document is added to a GZAC case. The verzoek plugin is triggered by a notification from the Notificaties API. Once the notification is received, the Verzoek plugin will use BPMN process to create a Valtimo case with a GZAC zaak.

## How does the plugin work

The lifecycle of a document verzoek is as follows:

1. A zaakinformatieobject is created in the Zaken API when (for example, by Kofax) a new document is linked to a zaak. The Zaken API automatically creates a Noticitaties API notification to notify all applications that a new zaakinformatieobject was created.
2. A DocumentVerzoekPluginEventListener retrieves the notification. The Document Verzoek plugin in Valtimo contains configuration to process these notifications.
3. The case, informatieobject and zaakinformatieobject which are listed in the event are retrieved from Open Zaak.
4. When the informatieobjecttype of the informationobject is listed in the plugin configuration, an event is broadcasted in BPMN.
5. A process can pick up the event for further processing. 

## Configure the plugin

A plugin configuration is required before the plugin can be used. A general description on how to configure plugins can be found [here](./#configuring-plugins).

If the Document Verzoek plugin is not visible in the plugin menu, it is possible the application is missing a dependency. Instructions on how to add the Verzoek Plugin dependency can be found [here](../../fundamentals/getting-started/modules/zgw/verzoek.md).

To configure this plugin the following properties have to be entered:

* **Notification API plugin (`notificatiesApiPluginConfiguration`).** Reference to another plugin configuration that will be used to receive a notification when a new verzoek is made.
* **Zaken API plugin (`zakenApiPlugin`).** Reference to another plugin configuration that will be used to retrieve the zaak zaakinformationobject.
* **Documenten API plugin (`documentenApiPlugin`).** Reference to another plugin configuration that will be used to retrieve the informatieobject.
* **Event message (`eventMessage`).** The message that is used to broadcast the event 
* **Informatieobjecttype Urls (`informatieobjecttypeUrls`).** A list urls of the informationobjecttypes that should be processed by this plugin.
