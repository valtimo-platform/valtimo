# 12.24.0

## Enhancements

* **Added the possibility to log an error when a Camunda process gets into incident status**

  When you set the Spring property `camunda.incident.alert-log.enabled` to `true`,
  an error will be logged when a Camunda process gets into incident status.
  This can be useful if you want to set up an alert at infrastructure level. More information about this feature can be found in the [incident error logging documentation](../../../features/process/process/incident-error-logging.md).
