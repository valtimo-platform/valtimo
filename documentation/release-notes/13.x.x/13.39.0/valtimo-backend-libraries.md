# Backend libraries 13.39.0

## New Features

The following features were added:

* **`PluginConfigurationCreatedEvent` and `PluginConfigurationUpdatedEvent`**

  Two new application events in `com.ritense.plugin.events`, published by `PluginService` when a
  plugin configuration is created or updated. Each event carries the affected `PluginConfiguration`.
  These allow consumers to react to plugin configuration changes in a targeted way, in addition to
  the existing `PluginsDeployedEvent` (still published) and `PluginConfigurationDeletedEvent`.

* **Logging for Notificatie API subscription (re)configuration**

  `PluginsDeployedEventListener` now logs the creation, update, and deletion of Notificatie API
  subscriptions ("abonnementen"): `INFO` on success and `WARN`/`ERROR` with the reason on failure,
  each scoped with the plugin configuration id (and request correlation id when available) via the
  logging context. Skipping because registration is disabled
  (`valtimo.zgw.register-abonnementen=false`) is now logged as well.

## Bugfixes

The following bugs were fixed:

* **Notificatie API subscriptions are now reliably (re)registered after commit**

  `PluginsDeployedEventListener` now reacts to `PluginConfigurationCreatedEvent`,
  `PluginConfigurationUpdatedEvent`, and `PluginConfigurationDeletedEvent` using a transactional
  event listener bound to the after-commit phase (like its process-link handlers). Previously
  (re)registration was triggered mid-transaction via `PluginsDeployedEvent`, so the remote
  subscription could be created/updated before the configuration change was committed, and retry
  failures were swallowed without any log output.

## Breaking changes

None.

## Deprecations

None.

## Known issues

None.
