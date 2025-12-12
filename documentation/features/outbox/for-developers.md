---
icon: laptop-code
---

# For developers

{% hint style="info" %}
The for developers section within each feature gives more tech heavy information of configuring, extending or altering Valtimo via the codebase.
{% endhint %}

<details>

<summary>Custom outbox message publisher</summary>

#### Creating a custom outbox message publisher

Valtimo offers the functionality needed to create and add custom outbox message publishers to Valtimo implementations. This is useful when the desired message broker (middleware) is not provided by Valtimo out of the box or by a third party.

Implementing a custom message publisher only requires work in the backend.

**Dependencies**

To create a custom message publisher in your project, the following dependency is needed:

```kotlin
    api("com.ritense.valtimo:outbox:$valtimoVersion") 
```

**Considerations**

The outbox pattern is designed to guarantee reliable (at least once) delivery.

Because of that, it is important to make sure messages are received by the broker when publishing. This can often be done by checking the response when it's a synchronous operation, or awaiting a response on an asynchronous channel.

Please refer to the documentation of your message broker and client. If message delivery cannot be guaranteed, consider using a different solution.

#### Implementing the MessagePublisher

The custom message publisher should implement the `com.ritense.outbox.publisher.MessagePublisher` interface from the `outbox` module:

```kotlin
class CustomMessagePublisher : MessagePublisher {

    override fun publish(message: OutboxMessage) {
        TODO("Send message to broker")
    }
}
```

When delivery fails or acknowledgement takes too long, a `MessagePublishingFailed` or a (subclass of) `RuntimeException` should be thrown to stop the transaction and keep the outbox message in the database for a retry later on.

When delivery is successful (no exceptions are thrown), the outbox message will be deleted from the outbox table automatically.

#### Bean configuration

The custom message publisher should be configured as a Bean in the Spring application.

```kotlin
@Configuration
@ConditionalOnOutboxEnabled // This will disable the bean creation when `valtimo.outbox.enabled` is set to false
class CustomMessagePublisherAutoconfiguration {

    @Bean
    @ConditionalOnMissingBean(MessagePublisher::class)
    fun customMessagePublisher(): MessagePublisher {
        return CustomMessagePublisher()
    }
}
```

</details>
