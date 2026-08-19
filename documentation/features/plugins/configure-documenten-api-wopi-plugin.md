# Documenten API WOPI plugin

The "Documenten API WOPI plugin" is used in combination with the "Documenten API plugin" to support opening, editing and 
collaborating on documents directly in the web browser.

## Requirements

To use the "Documenten API WOPI plugin" the following requirements must be met:

* The "Documenten API WOPI plugin" depends on version 1.1.0 of the [CG-DMF component][1]. 
  An open source implementation of the VNG Documenten API (version 1.5.0).  
* The "Documenten API plugin" must be configured. More details on configuring the "Documenten API plugin" can be found 
  in the [Documenten API plugin configuration guide](./configure-documenten-api-plugin.md).
* An online document editing suite that supports the WOPI protocol, such as [Collabora Online][2] or [OnlyOffice][3].

## Configure the plugin

The "Documenten API WOPI plugin" can be used to open, edit and collaborate on documents retrieved via the
"Documenten API plugin" in an online document editing suite via the WOPI protocol. The WOPI protocol is supported by
several online document editing suites, such as [Collabora Online][2] or [OnlyOffice][3]. Make sure one of these suites
is installed and configured in the Common Ground cluster and that you have access to the WOPI discovery URL provided by
the document editing suite.

> IMPORTANT:
> 
> The "Documenten API WOPI plugin" has only been fully tested with [Collabora Online][2], which is freely available as a
> docker image and should be installed separately (see [installation guide](https://collaboraonline.dev/docs/getting-started/installation)).  

To configure this plugin the following properties have to be entered:

* **Configuration ID (`configurationId`).** The plugin will be saved under this ID. The ID must be in the format of a UUID.
* **Configuration name (`configurationTitle`).** A user-friendly name that is used to identify the plugin (default value is "Documenten API WOPI").
* **WOPI Client Discovery URL (`wopiClientDiscoveryUrl`).** Contains the discovery URL of the WOPI client (document editing suite). For a default Collabora installation this should be `https://<your-collabora-host>:<port>/hosting/discovery`.
* **Documenten API plugin configuration (`documentenApiConfigurationId`).** Contains a reference to the configuration of the "Documenten API plugin". The preview plugin will retrieve documents based on this configuration.

## Configuring MIME types 

Valtimo / GZAC by default restricts the types of documents that can be uploaded to images and PDF files. To allow 
uploading additional document types, their MIME types have to be explicitly added to the `application.yaml`
configuration. For example to support Word documents (`.doc` and `.docx`) the MIME types `application/msword` and
`application/vnd.openxmlformats-officedocument.wordprocessingml.document` have to be added to the `mime-types` section
of the `application.yaml` file as shown below.

```yaml
spring:
  servlet:
    multipart:
      enabled: true
  codec:
    mime-types:
      - application/msword
      - application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

A complete list of MIME types for Microsoft Office documents can be found [here][4]. 

[1]: https://github.com/Baseflow/cg-dmf-poc/?tab=readme-ov-file
[2]: https://www.collaboraonline.com/
[3]: https://www.onlyoffice.com/
[4]: https://learn.microsoft.com/en-us/previous-versions/office/office-2007-resource-kit/ee309278%28v=office.12%29