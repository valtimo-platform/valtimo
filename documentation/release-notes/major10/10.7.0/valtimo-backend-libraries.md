# Valtimo backend libraries

## New Features

The following features were added:

*   **Security smoke testing**

    A new test class is made available to quickly check if all REST API endpoints apply some form of security using the new `SecuritySmokeIntegrationTest`. More information [here](../../../running-valtimo/application-configuration/security-testing.md).
*   **Automatic User Task assignment to Case Handler**

    It is now possible to have user tasks automatically assigned to a case handler. Refer [to this page](broken-reference) to learn more about this feature.
*   **Additional status on TaakObject**

    An additional status option `GESLOTEN` has been added to the [TaakStatus](https://github.com/valtimo-platform/valtimo-backend-libraries/blob/main/zgw/portaaltaak/src/main/kotlin/com/ritense/portaaltaak/TaakObject.kt#L49) enum of a TaakObject.
*   **Dashboard**

    The dashboard module has been added to support the new dashboard.

    * Information on how to include this module can be found [here](../../../fundamentals/getting-started/modules/core/dashboard.md).
    * Information on how to configure a dashboard can be found [here](../../../features/dashboard/).
    * Information on how to implement custom display types and datasources can be found [here](../../../features/dashboard/dashboard-1/).
* **Whitelisting by mime-type of files uploaded to temporary file storage** The types of files uploaded to the temporary file storage can now be restricted by whitelisting allowed mime-types. More information on this feature can be found [here](../../../running-valtimo/application-configuration/temporary-file-storage.md#whitelisting-file-types-for-uploads)
*   **Spring Actuator health check for Camunda incidents**

    A Spring Actuator health check has been added to monitor the number of Camunda incidents. If any incidents exist, the health indicator will be `UNKNOWN`. When no incidents exist, the indicator will be `UP`. More information about the Spring Actuator health endpoint can be found [here](https://docs.spring.io/spring-boot/docs/current/reference/html/actuator.html#actuator.endpoints.health).

    In addition, a custom `HealthAggregator` has been implemented to set the overall status to UNKNOWN in case one of the individual statuses is `UNKNOWN`.

## Bugfixes

The following bugs were fixed:

*   **Limit ClassGraph scanning**

    In rare cases an out of memory error could occur due to ClassGraph scanning all packages. This has been resolved by introducing a blacklist of libraries that don't need to be scanned.
*   **Summary pages fail to load because of duplicate process variables**

    When one or more processes had multiple process variables of the same name, the summary page for the related case would no longer load. Since process variables should not be used for the summary, these are no longer retrieved.

## Breaking changes

No breaking changes.

## Deprecations

No deprecations.

## Known issues

This version has the following known issues:

* **Main application in alternative package does not work properly**
  * Discovered in version 10.7.0
  * When the main Spring Boot application class (annotated with `@SpringBootApplication`) is not in `com.ritense.valtimo`, some configurations are not picked up properly. Known features that will be impacted are:
    * **Audit log**: view does not show any logs.
    * **Exception handling**: Exceptions are not translated to the correct http status codes. For instance, a `AccessDeniedException` results in a status `500` instead of `403`.
  * As a workaround, the following can be added to your main application class: `@SpringBootApplication(scanBasePackages = {"com.ritense.valtimo", "your.custom.package"})`.
