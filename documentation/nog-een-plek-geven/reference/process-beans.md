# Process beans

Process beans are Spring beans that can be used inside a Operaton BPMN process. The BPMN expression fields have access to all process beans. This page gives an overview of all available process beans.

## ConnectorService

This process bean makes it possible to interact with connectors inside the BPMN process.

```kotlin
fun getConnectorTypes()
```

Lists all connector-types.

```kotlin
fun getConnectorInstances(pageable: Pageable = Pageable.unpaged())
```

Lists all connector-instances.

```kotlin
fun getConnectorInstancesByType(typeId: UUID, pageable: Pageable = Pageable.unpaged())
```

Get a list of connector-instances by type ID

```kotlin
fun getConnectorInstancesByTypeName(typeName: String, pageable: Pageable = Pageable.unpaged())
```

Get a list of connector-instances by type name.

```kotlin
fun getConnectorInstanceById(id: UUID): ConnectorInstance
```

Get a connector-instance by id.

```kotlin
fun loadByName(name: String)
```

Loads the connector-instance by name.

```kotlin
fun loadByClassName(clazz: Class<T>)
```

Loads the connector-instance by class name

## CorrelationService

This process bean provides a way to manipulate jobs within the current process.

```kotlin
fun sendStartMessage(message: String, businessKey: String)
fun sendStartMessage(message: String, businessKey: String, variables: Map<String, Any>?)
fun sendStartMessageWithProcessDefinitionKey(message: String, targetProcessDefinitionKey: String, businessKey: String, variables: Map<String, Any>?)
fun sendCatchEventMessage(message: String, businessKey: String)
fun sendCatchEventMessage(message: String, businessKey: String, variables: Map<String, Any>?)
fun sendCatchEventMessageToAll(message: String, businessKey: String)
fun sendCatchEventMessageToAll(message: String, businessKey: String, variables: Map<String, Any>?)
fun sendGlobalCatchEventMessage(message: String)
fun sendGlobalCatchEventMessage(message: String, variables: Map<String, Any>?)
fun sendGlobalCatchEventMessageToAll(message: String)
fun sendGlobalCatchEventMessageToAll(message: String, variables: Map<String, Any>?)
```

Information on all methods can be found in the [correlation service documentation](../../features/process/correlation-service.md).

## JobService

This process bean provides a way to manipulate jobs within the current process or related to a specific case (business key).

```kotlin
fun updateTimerDueDateByActivityId(dueDateString: String, activityId: String, execution: DelegateExecution)
fun addOffsetInMillisToTimerDueDateByActivityId(millisecondsToAdd: Long, activityId: String, execution: DelegateExecution)
```

Information on all methods can be found in the [job service documentation](../../features/process/job-service.md).

## ProcessDocumentGenerator

This process bean provides an interface for generating documents.

```kotlin
fun generate(execution: DelegateExecution, mediaType: String, templateIdentifier: String)
```

Provides an interface for generating documents. This method only works if your implementation has overriden the interface to actually generate a document.

## MailService

This process bean is for sending emails.

```kotlin
fun sendElementTemplateTaskMail(execution: DelegateExecution)
```

Is able to send an email using the configured Operaton extension properties. The extension properties are:

* `mailSendTaskFrom` - The email-address of the sender.
* `mailSendTaskSubject` - The subject of the email.
* `mailSendTaskTo` - The email-address of the receiver.
* `mailSendTaskTemplate` - The template that is used for the email. The template often has placeholders. The method uses all process variables as possible placeholders for the template.

## DocumentDelegate

This process bean is deprecated. Please use the `DocumentDelegateService` process bean instead.

## DocumentVariableDelegate

This process bean is deprecated. Please use the `DocumentDelegateService` process bean instead.

## DocumentDelegateService

This process bean is for retrieving and updating the document.

```kotlin
fun getDocumentVersion(execution: DelegateExecution)
```

Returns the version of the document.

```kotlin
fun getDocumentCreatedOn(execution: DelegateExecution)
```

Returns the creation date of the document.

```kotlin
fun getDocumentCreatedBy(execution: DelegateExecution)
```

Returns the email of the creator of the document.

```kotlin
fun getDocumentModifiedOn(execution: DelegateExecution)
```

Returns the last modified date of the document.

```kotlin
fun getDocumentAssigneeId(execution: DelegateExecution)
```

Returns the ID of the person assigned to the document version.

```kotlin
fun getDocumentAssigneeFullName(execution: DelegateExecution)
```

Returns the full name of the person assigned to the document.

```kotlin
fun getDocument(execution: DelegateExecution)
```

Returns the entire document as an object.

```kotlin
fun findValueByJsonPointer(jsonPointer: String?, execution: DelegateExecution?)
```

Returns the value retrieved from the document at a given pointer.

```kotlin
fun findValueByJsonPointerOrDefault(jsonPointer: String?, execution: DelegateExecution, defaultValue: Any)
```

Returns the value retrieved from the document at a given pointer, or the given default when the property described by the pointer does not exist.

```kotlin
fun setAssignee(execution: DelegateExecution, userEmail: String?)
```

Assigns a person to a document.

```kotlin
fun unassign(execution: DelegateExecution)
```

Removes the assigned person from a document.

## ProcessDocumentsService

This process bean is for functions that affect both the document and the process.

```kotlin
fun startProcessByProcessDefinitionKey(processDefinitionKey: String, documentId: String)
fun startProcessByProcessDefinitionKey(processDefinitionKey: String, documentId: String, variables: Map<String, Any>?)
```

Starts a new process and attaches it to the current document.

## ValueResolverDelegateService

This process bean contains functions for accessing the Valtimo value resolver. More information in the [value resolver documentation](../../fundamentals/getting-started/modules/core/value-resolver.md)

### Resolve value

```kotlin
fun resolveValue(execution: DelegateExecution, key: String)
```

Resolves a value from a specified source. The resolved value is only returned. An example:

```spel
${execution.setVariable('firstName', valueResolverDelegateService.resolveValue(execution, 'doc:person.firstName'))}
```

### Handle value

```kotlin
fun handleValue(execution: DelegateExecution, key: String, value: Any)
```

Handles a value for a specified target. The example below shows how a process-variable is stored in the document on path `/person/firstName`:

```spel
${valueResolverDelegateService.handleValue(execution, 'doc:person.firstName', execution.getVariable('firstName'))}
```

## TimerService

Reschedules active BPMN timer jobs belonging to a case to a new due date. Useful for flows where a case-level date (e.g. exam date) changes and timer-driven activities need to be realigned.

### Update all active timers

```kotlin
fun updateActiveTimers(businessKey: String, newDate: String): Int
```

Reschedules every active timer job across all running process instances that share the given business key.

- `businessKey`: the process business key (typically the document/case ID).
- `newDate`: the new due date as an ISO-8601 instant (e.g. `2026-05-01T00:00:00Z`).

```spel
${timerService.updateActiveTimers(execution.processBusinessKey, execution.getVariable('newDate'))}
```

### Update specific active timers

```kotlin
fun updateActiveTimers(businessKey: String, newDate: String, vararg activityIds: String)
```

Same as above but restricts the update to timer jobs whose BPMN activity ID is in the supplied list.

- `businessKey`: the process business key (typically the document/case ID).
- `newDate`: the new due date as an ISO-8601 instant.
- `activityIds`: one or more BPMN activity IDs to limit which timer jobs are rescheduled.

```spel
${timerService.updateActiveTimers(execution.processBusinessKey, execution.getVariable('newDate'), 'exam-logistics-wait-for-allocate-students-and-rooms')}
```

```spel
${timerService.updateActiveTimers(execution.processBusinessKey, execution.getVariable('newDate'), 'exam-logistics-timer_6_weeks_prior_to_exam_date', 'exam-logistics-timer_4_weeks_prior_to_exam_date')}
```
