# Zaken API plugin

The Zaken API plugin can be used to store and access data about a Zaak (case) in an application that supports the Zaken API standard created and used by the Dutch government.

## Configure the plugin

A plugin configuration is required before the plugin can be used. A general description on how to configure plugins can be found [here](../../plugins/configure-plugin.md).

If the Zaken API plugin is not visible in the plugin menu, it is possible the application is missing a dependency. Instructions on how to add the Zaken API dependency can be found [here](../../../fundamentals/getting-started/modules/zgw/documenten-api.md).

To configure this plugin the following properties have to be entered:

* **URL.** Contains the complete base URL of the Zaken API to connect to. This generally includes the path `/api/v1/`.
* **Authentication plugin configuration.** Reference to another plugin configuration that will be used to add authentication to any request performed on the Zaken API. If no option is available in this field a plugin has to be configured that is able to authenticate for the specific application that hosts the Zaken API. (e.g. OpenZaak)

An example plugin configuration: ![example plugin configuration](../../../using-valtimo/plugin/zaken-api/img/configure-plugin.png)

## Available actions

The Zaken API plugin supports the following actions that can be configured in process links in order to manage data that is part of the Zaak.

A general description on how to create process links, can be found [here](broken-reference).

### Link document to zaak

The **Link document to zaak.** action takes a Document stored in a Documenten API and links it to a zaak. The zaak to which the Document is linked is based on the process for which the action is performed. The process belongs to a case that should already have a zaak instance link before this action is performed. The link between a zaak and a document is stored as a 'zaakinformatieobject' in the Zaken API.

When creating a process link the following properties have to be entered:

* **URL to the document.** The complete URL of the document in a Documenten API.
* **Document title.** The title of the document within the context of the zaak that is stored in the 'zaakinformatieobject' record in the Zaken API.
* **Document description.** The description of the document within the context of the zaak that is stored in the 'zaakinformatieobject' record in the Zaken API.

An example process link configuration: ![Generate document process link](../../../using-valtimo/plugin/zaken-api/img/link-document-to-zaak.png)

### Link uploaded document to zaak

The **Link uploaded document to zaak** action takes a document stored in a Documenten API and links it to a zaak. The zaak to which the document is linked is based on the process for which the action is performed. The process belongs to a case that should already have a zaak instance link before this action is performed. The link between a zaak and a document is stored as a 'zaakinformatieobject' in the Zaken API. After this plugin action has been selected, the user does not have to input any configuration data.

This process link does the following steps:

1. Take the document URL that is saved in the process variable `documentUrl`.
2. Take the Zaak instance that is linked to the case.
3. Link the Zaak instance to the document URL.

### Create zaak

The **Create zaak** action creates a zaak in the zaken API. When creating a process link the following properties have to be entered:

* **RSIN.** Contains the RSIN of the organisation. The RSIN number (Rechtspersonen en Samenwerkingsverbanden Identificatie Nummer in Dutch) is an identification number for legal entities and partnerships. This will be used when creating the zaak to indicate who is responsible for creating the zaak record in the API.
* **Zaak type.** The type of the zaak that is created.

### Create zaakrol - natural person

The **Create zaakrol - natural person** action creates a zaakrol in the zaken API. Using this action, a person can be linked to a zaak. When creating a process link the following properties have to be entered:

* **Role type URL.** Every person that is linked to a zaak has a role within that zaak. This property contains a URL to the role of the zaak.
* **Role explanation.** An explanation of the role that the person has within the zaak.
* **Initiator BSN.** The BSN (Citizen service number) of the person that should be linked to the zaak.
* **Other natural person identification.** (Optional) The unique number issued by the municipality for another natural person.
* **Administration number person.** (Optional) The administration number of the person, as referred to in the BRP Act.
* **Resultaat process variable** (Optional) The name of the process variable that should be set to the UUID of the zaakrol that was created.

### Create zaakeigenschap

The **Create zaakeigenschap** action creates a zaakeigenschap in the zaken API. When creating a process link the following properties can be entered:

* **Case definition.** The case definition that is linked to a zaken API plugin configuration.
* **Eigenschap.** The eigenschap as configured in the catalogi API.
* **Property URL.** Alternatively, a URL can be entered that references to an eigenschap in the catalogi API.
* **Eigenschap value.** The value that the zaakeigenschap should get when the process-link action is executed.

### Update zaakeigenschap

The **Update zaakeigenschap** action updates a zaakeigenschap in the zaken API. When creating a process link the following properties can be entered:

* **Case definition.** The case definition that is linked to a zaken API plugin configuration.
* **Eigenschap.** The eigenschap as configured in the catalogi API.
* **Property URL.** A URL can be entered that references to an eigenschap in the catalogi API. This is an alternative to providing an eigenschap.
* **Eigenschap value.** The value that the zaakeigenschap should get when the process-link action is executed.

### Delete zaakeigenschap

The **Delete zaakeigenschap** action deletes a zaakeigenschap in the zaken API. When creating a process link the following properties can be entered:

* **Case definition.** The case definition that is linked to a zaken API plugin configuration.
* **Eigenschap.** The eigenschap as configured in the catalogi API.
* **Property URL.** A URL can be entered that references to an eigenschap in the catalogi API. This is an alternative to providing an eigenschap.

### Delete zaakrol

The **Delete zaakrol** action deletes a zaakrol in the zaken API. When creating a process link the following properties can be entered:

* **Rol UUID** The UUID of the zaakrol that should be deleted.

### Start recovery period

The **Start recovery period** will start a recovery period for the linked zaak in the zaken API. If a zaak has a due date (Uiterlijke einddatum afdoening) set, the due date will be extended with the configured maximum duration of the recovery period. The zaak will also be suspended.

After starting the recovery period, the due date becomes: `zaak.originalDueDate + maximumDuration`

* **Maximum duration in days.** The maximum duration of the recovery period in days.

### End recovery period

The **End recovery period** will end a recovery period for the linked zaak in the zaken API. The original due date (Uiterlijke einddatum afdoening) of the zaak will be extended by the actual duration of the recovery period. This is achieved by _subtracting_ the difference between the actual duration and the maximum duration of the recovery period. The zaak is no longer suspended.

After ending the recovery period, the due date becomes: `(zaak.originalDueDate + maximumDuration) - (actualDuration - maximumDuration)`

### Retrieve zaakbesluiten

The **Retrieve zaakbesluiten** fetches all zaakbesluit URLs from the zaak in the zaken API. When creating a process link the following property can be entered:
* **Result process variable** The name of the process variable in which the zaakbesluit URLs must be stored.

