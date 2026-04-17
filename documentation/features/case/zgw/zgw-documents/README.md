# Documents

ZGW Documents are the documents that are stored using the Documenten API.

## Plugin configuration

To use ZGW documents, the [documenten-api](../../../../fundamentals/getting-started/modules/zgw/documenten-api.md) module needs to installed. Instructions on how to use and configure the plugin(s) can be found in the [Documenten API plugin configuration](../../../plugins/configure-documenten-api-plugin.md)

## Configuring the document list

The admin can configure some aspects to the document list.

### Keywords (trefwoorden)

Keywords can be added to documents when uploading. This helps in categorizing the documents. GZAC does not allow a user to add keywords freely to prevent cluttering the data. Instead, the keywords a user can add should be configured in the case configuration at `Admin > Case > {Case name} > [ZGW] > [Document trefwoorden]`. At this page the currently configured keywords will be listed. You can also add new keywords, or delete them.

> NOTE: Deleting keywords will not delete existing documents from the Documenten API, nor will it delete the keyword from existing documents. Deleted keywords will just not be available anymore when uploading a document

#### Auto-deployment

Keyword configuration can also be loaded via auto-deployment. To do so, create a json file in the application classpath which conforms to the following pattern: `*.zgw-document-trefwoorden.json`

The contents should follow the structure in the example below:

**my-zaak.zgw-document-trefwoorden.json**

```json
[
    "some-trefwoord",
    "some-other-trefwoord",
    "some-third-trefwoord"
]
```

### List columns

List columns can be configured to change what data is shown in the document list view.

#### Auto-deployment

List column configuration can also be loaded via auto-deployment. To do so, create a json file in the application classpath which conforms to the following pattern: `*.zgw-document-list-column.json`

The contents should follow the structure in the example below:

**my-zaak.zgw-document-trefwoorden.json**

```json
{
  "changesetId": "my-zaak.zgw-document-list-columns-v1",
  "case-definitions": [
    {
      "key": "my-zaak",
      "columns": [
        "AUTEUR",
        "STATUS",
        "FORMAAT",
        "TAAL",
        "VERSIE",
        "BESTANDSNAAM"
      ]
    }
  ]
}
```

The following columns are available for configuration:

* `AUTEUR`
* `BESCHRIJVING`
* `BESTANDSNAAM`
* `BESTANDSOMVANG`
* `BRONORGANISATIE`
* `CREATIEDATUM`
* `FORMAAT`
* `IDENTIFICATIE`
* `INFORMATIEOBJECTTYPE_OMSCHRIJVING`
* `LOCKED`
* `STATUS`
* `TAAL`
* `TITEL`
* `VERSIE`
* `VERTROUWELIJKHEIDAANDUIDING`

## Enabling virus scanning

To ensure that documents uploaded to the Documenten API are free of viruses, they can be scanned in advance using a virus scanner. When enabled, scans are performed by the ClamAV service.

When receiving a document from an external resource it is stored in the temporary resource storage service before it is uploaded to the Documenten API. 
When both scanning`DocumentenApiPlugin` and `TemporaryResourceStorageService` are enabled, the virus scanning will not be performed twice.

To enable virus scanning, set the following Spring properties:
The `hostName` and `port` properties are specific to the ClamAV service.

#### **`application.yml`**

```yaml
valtimo:
    virusscan:
        clamav:
            properties:
                hostName: localhost
                port: 3310
            DocumentenApiPlugin:
                enabled: true
            TemporaryResourceStorageService:
                enabled: true
```
#### Example Running the clamav service
```bash
docker run -d --name clamav -p 3310:3310 clamav/clamav-debian:latest
```
