# Logging incidents when retries are exhausted

When a process encounters an error during execution, Camunda logs the error and, depending on the configured [retry cycle](../retry-cycle.md), retries the failed task.
Once all retries are exhausted, the process enters an incident state and further execution is halted.
At this point, manual intervention is usually required to investigate and resolve the issue.

Because incidents often require manual action, it can be useful to set up an alert for this at the infrastructure level.
By default, Camunda does **not** log a dedicated message when a process enters an incident state due to exhausted retries.

## Enabling incident alert logging

To log a message when an incident is created, enable the following Spring configuration property:

```yml
camunda.incident.alert-log.enabled: true
```
The default log message is:
> CAMUNDA_INCIDENT_FAILED_JOB: processInstanceId={processInstanceId} incidentId={incidentId}
This makes it possible to configure alerts or triggers based on log entries containing the text "CAMUNDA_INCIDENT_FAILED_JOB".
## Customizing the log message
You can customize the log message using the Spring configuration property `camunda.incident.alert-log.message-template`.

For example:

```yml
camunda.incident.alert-log.message-template: "An Camunda process has been placed in incident status after exhausting all retries: Process instance ID: {processInstanceId}"
```

The following placeholders are supported in the template:

- `{processInstanceId}` - the ID of the process instance
- `{incidentId}` - the ID of the incident

These placeholders will be replaced with their corresponding values at runtime.
