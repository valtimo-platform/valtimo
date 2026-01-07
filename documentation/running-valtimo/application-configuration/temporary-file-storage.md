# Temporary file storage

Temporary resource storage provides a service for storing files locally, e.g. to process it during following tasks. These files are removed after a preconfigured time and should be processed further before that timer ends.

> This page is missing information. Would you like to contribute? Please read [Contributing to Valtimo](/broken/pages/Vh8fwBABrBva9fbRcS1D)

## Whitelisting file types for uploads

Available since 10.7.0

It is possible to restrict the allowed files types for upload. When uploading, the detected mime-type of a file is checked against the configured whitelist.

The whitelist can be configured as follows in the application properties:

```yaml
valtimo:
  upload:
    acceptedMimeTypes:
      - text/plain
      - application/pdf
      - image/jpeg
      - application/xml
```

When the whitelist is not defined or empty, no filtering will be applied.
