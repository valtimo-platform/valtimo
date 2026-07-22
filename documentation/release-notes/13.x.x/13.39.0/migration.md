# Migration

This page describes how to update Valtimo from the previous version to the current.

No migration steps are required for this version. The new `PluginConfigurationCreatedEvent` and
`PluginConfigurationUpdatedEvent` are additive and the existing `PluginsDeployedEvent` is still
published, so existing consumers keep working unchanged.
