# Valtimo backend libraries

## New Features

The following features were added:

*   **Added Portaaltaak plugin**

    This plugin makes it possible for Valtimo to communicate and interact with a Portaaltaak specification compliant ZGW component.
*   **Valtimo dependencies**

    Two new modules have been introduced to help with managing dependencies. These are [Valtimo dependencies](../../../fundamentals/getting-started/modules/core/valtimo-dependencies.md) and [Valtimo GZAC dependencies](../../../fundamentals/getting-started/modules/zgw/valtimo-gzac-dependencies.md). Including these dependencies in a project will automatically include the core modules for that edition of Valtimo, which also improves the experience when upgrading Valtimo to a new version.
*   **Process beans**

    For documentation on Spring beans, see the Spring documentation [here](https://docs.spring.io/spring-framework/docs/current/reference/html/core.html).

    By default, all beans are available for use within a BPMN, e.g. to send and email. By setting the `valtimo.camunda.bean-whitelisting = true` property in the `application.yml`, only whitelisted beans are available. Beans can be whitelisted by defining them with the `@ProcessBean` annotation.
* **Plugin Events**\
  It is now possible to have plugin methods run whenever a plugin configuration created, updated or deleted. More information on this feature can be found [here](../../../features/plugins/plugins/custom-plugin-definition.md#plugin-events).
* **Improved Notificaties API plugin**\
  The following improvements have been made to this plugin:
  * An additional input is required when configuring the plugin: `callbackUrl`. This is required by Notificaties API to know where to send notification requests.
  * Plugin Events have been implemented so that a Notificaties API subscription is made, updated or removed when the corresponding interaction is done with the Plugin.

## Bugfixes

The following bugs were fixed:

*   **Fixed Notificaties API response mapping**

    The response from OpenNotificaties when creating a subscription is missing a required property. This was causing a Runtime Exception while mapping the response.
*   **Fixed NullPointerException on startup**

    Changing a process definition could cause a NullPointerException on startup when migrating the process links. This resulted in a failed start of the application.

## Breaking changes

The following breaking changes were introduced:

* **Changed Notificaties API Abonnement Link database table column**\
  A Liquibase changeset was added to modify the column name.

## Deprecations

No new deprecations.

## Known issues

No new known issues.
