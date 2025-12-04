# Valtimo backend libraries

## New Features

The following features were added:

*   **Added new Notificaties API plugin**

    This plugin makes it possible for valtimo to communicate and interact with a Notificaties API specification compliant ZGW component.
*   **Added new OpenNotificaties plugin**

    This plugin facilitates authentication for the Notificaties API plugin when interfacing with [OpenNotificaties](https://github.com/open-zaak/open-notificaties).
*   **Automatically migrate linked plugin actions**

    Plugin actions that are linked to the latest process version will now automatically be linked to a new version of the process that is being deployed.

## Bugfixes

The following bugs were fixed:

*   **Multiple form flow instances linked to task**

    In some situations when a user tried to open a user task multiple times, the user would get the error: 'Multiple form flow instances linked to task'. This has been fixed for every new user tasks that is created after the upgrade to 10.2.0. Users can still get the error when opening an old user task.

## Breaking changes

No breaking changes.

## Deprecations

No new deprecations.

## Known issues

* **Startup might fail due to NullPointerException**
  * Discovered in version 10.2.0
  *   When a process definition has been updated, this might result in an error at startup:

      `java.lang.NullPointerException: Cannot invoke "org.camunda.bpm.engine.impl.interceptor.CommandContext.getProcessDefinitionManager()" because the return value of "org.camunda.bpm.engine.impl.context.Context.getCommandContext()" is null`
  * Startup usually succeeds after a few tries.
  * No workaround available. The issue has been fixed on 10.3.0
