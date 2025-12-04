# Valtimo backend libraries

## New Features

The following features were added:

*   **Export case definitions**

    Case definitions can now be exported as an archive, containing all process definitions, forms, form flows, process links and the document definition that make up the case definition. See [this page](https://app.gitbook.com/s/bcArISKZtxWk4tKpZb9P/features/case) for more information.
*   **Import case definitions**

    Case definitions can now be imported from a ZIP archive, containing all process definitions, forms, form flows, process links and the document definition that make up the case definition. See [this page](https://app.gitbook.com/s/bcArISKZtxWk4tKpZb9P/features/case) for more information.
*   **Transactional outbox**

    Valtimo now supports an implementation of the [transactional outbox pattern](https://microservices.io/patterns/data/transactional-outbox.html). See [this page](../../../fundamentals/getting-started/modules/core/outbox/) for more information.
*   **Audit CloudEvents**

    Several outbox events have been added for auditing purposes. For an overview of the available events, refer to [this page](broken-reference/)
* **Access control for creating process instances** Two new access control resources have been added, these are `CamundaExecution` and `CamundaProcessDefinition`. The former has one action that can be used to allow users to create process instances, which is the `create` action. These resources can be used to restrict creation of certain process instances to a subset of roles. Information on how to use this can be found [here](../../../features/access-control/configuring-permissions.md#create-process-instance-permissions).
*   **Outbox message publisher for RabbitMQ**

    A RabbitMQ (AMQP 0.9.1) message publisher has been in the `outbox-rabbitmq` module. More information can be found [here](../../../fundamentals/getting-started/modules/core/outbox/outbox-rabbitmq.md).
*   **Added option for custom process variable name to download document plugin action in documentAPI**

    Added option for custom process variable name to download document plugin action in documentAPI so you have the option to choose a custom process variable name. When left empty the default name is: "resourceId"
*   **Selecting and retrieving a specific version of a document definition**

    To support switching between document definition versions, two new API endpoints have been added. The first is to retrieve a list of versions available for that document definition, and the second to retrieve a specific version:

    * `GET /api/management/v1/document-definition/{name}/version`
    * `GET /api/management/v1/document-definition/{name}/version/{version}`
*   **Javascript in Camunda script task**

    Added support for Javascript in Camunda script tasks.
*   **Value resolver process bean**

    Added a new process bean that can resolve and handle values from several sources. More information can be found [here](../../../nog-een-plek-geven/reference/process-beans.md#valueresolverdelegateservice)
*   **Support for Keycloak group roles in access control**

    Valtimo access control can now make use of Keycloak group roles.
*   **Access control mapping CamundaTask to JsonSchemaDocument**

    The PBAC CamundaTask resource can now make use of a JsonSchemaDocument for conditions.
*   **Configure due date from BPMN for portaaltaak**

    If no due date is given in the _Create portaal taak_ action, the due date of the user task is used instead.
*   **Spring bean for JSON mapper**

    Valtimo now uses a Spring managed ObjectMapper to map from JSON to classes and vice versa.

## Bugfixes

The following bugs were fixed:

*   **Deadlock**

    A deadlock could happen under certain conditions when modifying the document inside a BPMN process.
*   **Form flow instance back and forward navigation**

    When moving forwards and backwards in a form flow instance with conditional steps, steps might exist that were completed in a different branch of the path. This could sometimes result in navigation issues.
*   **Error in 'Create zaakstatus' action**

    A bug has been fixed where the process link 'Create zaakstatus' would result in an error when the 'Zaakstatus explanation' field was left empty.
*   **Case date search**

    Date search fields now take into account the timezone offset sent along with requests under the `X-Timezone-Offset` request header. If this header is not present, UTC+0 is used.

## Breaking changes

No breaking changes.

## Deprecations

The following was deprecated:

*   **Mapper classes**

    Multiple classes related to the Jackson ObjecMapper have been deprecated:

    * `com.ritense.valtimo.contract.json.Mapper`
    * `com.ritense.document.domain.impl.Mapper`
    * `com.ritense.openzaak.service.impl.Mapper`
    * `com.ritense.form.domain.Mapper`
    * `com.ritense.formlink.domain.impl.formassociation.Mapper`

    These classes should be replaced by the new `com.ritense.valtimo.contract.json.MapperSingleton`.

## Known issues

No known issues.
