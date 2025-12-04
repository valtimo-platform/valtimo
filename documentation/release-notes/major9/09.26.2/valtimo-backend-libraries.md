# Valtimo backend libraries (9.26.2)

## New Features

No new features.

## Bugfixes

The following bugs were fixed:

* **Not all users shown in candidate users dropdown** The dropdown list with candidate users on a case page, now shows all users. There was a bug that caused the API endpoint to not respond with all users when there were more than 200 Keycloak users.

## Breaking changes

* **Swagger has been replaced by OpenAPI** The `/v2/api-docs` endpoint is no longer available and has been replaced by `/v3/api-docs`

Instructions on how to migrate to this version of Valtimo can be found [here](migration.md).

## Deprecations

No new deprecations.

## Known issues

No new known issues.
