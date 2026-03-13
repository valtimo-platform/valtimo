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

### Step 3: Register translations via `CASE_AUDIT_TRANSLATION_TOKEN`

The audit tab uses the simple class name of the event as a translation key under the `events` namespace. The recommended way to supply translations is via the `CASE_AUDIT_TRANSLATION_TOKEN` injection token exported from `@valtimo/case`. Add a provider in your `app.module.ts` (or any Angular module):

```typescript
import {CASE_AUDIT_TRANSLATION_TOKEN} from '@valtimo/case';

// In your NgModule providers array:
{
  provide: CASE_AUDIT_TRANSLATION_TOKEN,
  useValue: {
    en: {MyCustomEvent: 'Something happened: {{description}}'},
    nl: {MyCustomEvent: 'Er is iets gebeurd: {{description}}'},
  },
  multi: true,
}
```

All fields on the event object are available as interpolation parameters in the translation string. Multiple providers can be registered — each one is merged independently under the `events` namespace.

{% hint style="info" %}
**Scoping guarantee:** The token only accepts `{ [eventClassName]: string }` per language — the `events.` namespace prefix is always added by the framework. It is not possible to accidentally overwrite unrelated translation keys.
{% endhint %}

#### Alternative: static JSON translation files

For simple single-language cases you can also add the translation directly to the i18n asset files of the front-end implementation:

**`assets/i18n/en.json`**

```json
{
  "events": {
    "MyCustomEvent": "Something happened: {{description}}"
  }
}
```
