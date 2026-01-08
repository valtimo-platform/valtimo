# Outbox RabbitMQ

## Dependencies

The `outbox-rabbitmq` module provides an outbox message publisher for RabbitMQ.

### Backend

The samples below assume the [valtimo-dependency-versions](../valtimo-dependency-versions.md) module is used. If not, please specify the artifact version as well.

#### Maven dependency:

```xml

<dependencies>
  <dependency>
    <groupId>com.ritense.valtimo</groupId>
    <artifactId>outbox-rabbitmq</artifactId>
    <version>${valtimo_version}</version>
  </dependency>
</dependencies>
```

#### Gradle dependency:

```kotlin
dependencies {
    implementation("com.ritense.valtimo:outbox-rabbitmq")
}
```

## Configuration

In order to use this module, the following configuration properties need to be added to the application properties. Please adjust values to match the environment:

#### **`application.yml`**

```yaml
spring:
  rabbitmq:
    host: localhost
    port: 5672
    username: guest
    password: guest
    ssl.enabled: true # Optional. Defaults to false
    publisher-confirm-type: correlated # required value
    publisher-returns: true # required value

valtimo:
  outbox:
    publisher:
      rabbitmq:
        exchange: valtimo-events # Optional. Defaults to `spring.rabbitmq.template.exchange`.
        routing-key: valtimo-audit # Optional. Defaults `spring.rabbitmq.template.routing-key`.
        delivery-timeout: "PT0.5S" # ISO 8601 duration format
```

Using an exchange can be useful when you want more refined control over what targets (queues or topics) will receive the message. It is also possible to setup multiple targets via the RabbitMQ configuration.
