# 12.33.0

## New Features

* **New feature title**

  New feature explanation.

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
