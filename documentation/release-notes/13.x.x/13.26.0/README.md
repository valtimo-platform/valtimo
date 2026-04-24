# 13.26.0

{% hint style="info" %}
**Release date 29-04-2026**
{% endhint %}

## New Features

* **IKO Search FormIO component**

  A new custom FormIO component allows case workers to search and select an IKO result directly inside a user task
  form. When a result is selected, the ID and any configured property values from the search result table are written
  to the case document as a single object. This data can then be used in subsequent process steps or displayed in case
  widgets using `doc:` value resolver paths, removing the need for additional IKO API calls at display time. See
  [Search FormIO component](../../../features/iko/search-formio-component.md) for configuration details.

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
