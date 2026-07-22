# 13.39.0

{% hint style="info" %}
**Release date 29-07-2026**
{% endhint %}

## New Features

* **Application events for plugin configuration create and update**

  Two new Spring application events are published when a plugin configuration is created or updated:
  `PluginConfigurationCreatedEvent` and `PluginConfigurationUpdatedEvent`. Both carry the affected
  `PluginConfiguration`, so consumers can react to plugin configuration changes in a targeted way.
  The existing `PluginsDeployedEvent` and `PluginConfigurationDeletedEvent` remain unchanged.

## Enhancements

* **Logging for Notificatie API subscription (re)configuration**

  Creating, updating, and deleting a subscription ("abonnement") against the Notificatie API now
  writes a clear log entry. Successful operations log at `INFO` level; failures log at `WARN`/`ERROR`
  level including the reason. Each entry carries a correlation id (the plugin configuration id and,
  for HTTP-triggered changes, the request correlation id) so a subscription change can be traced.
  When subscription registration is disabled (`valtimo.zgw.register-abonnementen=false`) this is now
  logged instead of being silent.

## Bugfixes

* **Notificatie API subscriptions are now reliably (re)registered on plugin configuration changes**

  When a plugin that relies on the Notificatie API (such as the Verzoek plugin) is added, modified,
  or removed, its subscription is now (re)registered only after the configuration change has been
  committed. Previously the registration ran mid-transaction, which could leave the remote
  subscription inconsistent with the stored configuration, and failures were swallowed without a
  trace in the logs.
