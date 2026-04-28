# 12.33.0

## New Features

* **Document-level access control for ZGW documents**

  Permissions for ZGW documents can now include conditions on document properties such as confidentiality level,
  status, and document type. This allows administrators to control which documents a user can view, modify, or delete
  based on the document's properties — not just the case it belongs to. Action buttons in the documents tab
  automatically reflect these permissions.

  For more information, see [ZGW Documents - Access control](../../../features/zgw/zgw-documents/access-control.md).

## Enhancements

* **Improved REST client error logging security**

  The `LoggingRestClientCustomizer` no longer includes request and response bodies or headers in exception messages.
  Previously, when an external REST call returned an error status, the full request report — including potentially
  sensitive data such as tokens, API keys, or personal information — was embedded in the `HttpClientErrorException`
  message. This could cause sensitive data to leak into error handlers, monitoring tools, or API responses.

  The detailed request and response information is now only available at `DEBUG` log level, which is typically disabled
  in production. The exception itself only contains the HTTP status code and status text. See
  [REST client logging](../../features/logging/for-developers.md#rest-client-logging) for configuration details.

## Bugfixes

* New bugfix.
