# Custom audit events

This page explains how custom events can be shown in the audit tab on the case detail page.

## Introduction

The audit tab on the case detail page shows a history of events that occurred for a case. By default, Valtimo includes 15 built-in event types (such as document created, task completed, process started). When building a plugin or extension that publishes its own audit events, those events will not appear in the audit tab unless they are registered.

The `DocumentAuditEventProvider` interface makes this possible. Implement it as a Spring bean to register additional event types that Valtimo will include in the audit query.

## Registering custom audit events

### Step 1: Publish an audit event

Create an event class that extends `AuditMetaData` and implements `AuditEvent`, then publish it via Spring's `ApplicationEventPublisher`.

```kotlin
import com.ritense.valtimo.contract.audit.AuditEvent
import com.ritense.valtimo.contract.audit.AuditMetaData
import java.time.LocalDateTime
import java.util.UUID

class MyCustomEvent(
    id: UUID,
    origin: String,
    occurredOn: LocalDateTime,
    user: String,
    val documentId: UUID,
    val description: String,
) : AuditMetaData(id, origin, occurredOn, user), AuditEvent
```

Publish it from a service:

```kotlin
import org.springframework.context.ApplicationEventPublisher

@Service
class MyService(private val eventPublisher: ApplicationEventPublisher) {

    fun doSomething(documentId: UUID) {
        // ... business logic ...
        eventPublisher.publishEvent(
            MyCustomEvent(
                id = UUID.randomUUID(),
                origin = "MyService",
                occurredOn = LocalDateTime.now(),
                user = currentUser,
                documentId = documentId,
                description = "Something happened",
            )
        )
    }
}
```

### Step 2: Register a `DocumentAuditEventProvider` bean

```kotlin
import com.ritense.processdocument.service.DocumentAuditEventProvider
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class MyAuditConfiguration {

    @Bean
    fun myAuditEventProvider() = DocumentAuditEventProvider {
        listOf(MyCustomEvent::class.java)
    }
}
```

Multiple providers can coexist. Valtimo collects them all and merges the event type lists, so registering a provider never interferes with other providers or the built-in events.

### Step 3: Add a translation entry

The audit tab uses the simple class name of the event as a translation key under the `events` namespace. Add a translation entry in the i18n files of the front-end implementation:

**`assets/i18n/en.json`**

```json
{
  "events": {
    "MyCustomEvent": "Something happened: {{description}}"
  }
}
```

All fields on the event object are available as parameters in the translation string.
