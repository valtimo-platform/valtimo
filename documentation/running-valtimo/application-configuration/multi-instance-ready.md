# Temporary file-storage

It can be desirable to run multiple instances of the same Valtimo implementation. In that case, some additional steps are required to make your Valtimo implementation multi instance ready.

## Shared storage

In some cases, Valtimo saves a file to the local storage. All instances of Valtimo must be configured to use the same storage. Please note that this directory should already exist and will not be created by Valtimo.

## Shared directory for temporary files

Besides having shared storage, all Valtimo instances must also be configured to use the same directory for temporary files. This can be set with the property: `valtimo.resource.temp.directory` or with environment variable: `VALTIMO_RESOURCE_TEMP_DIRECTORY`
