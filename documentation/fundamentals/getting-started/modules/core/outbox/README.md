# Outbox

## Dependencies

Valtimo contains an implementation of the [transactional outbox pattern](https://microservices.io/patterns/data/transactional-outbox.html). To make use of this pattern, the `outbox` module needs to be added as a dependency. The following can be added to your project, depending on whether Maven or Gradle is used:

### Backend

The samples below assume the [valtimo-dependency-versions](../valtimo-dependency-versions.md) module is used. If not, please specify the artifact version as well.

#### Maven dependency:

```xml

<dependencies>
  <dependency>
    <groupId>com.ritense.valtimo</groupId>
    <artifactId>outbox</artifactId>
    <version>${valtimo_version}</version>
  </dependency>
</dependencies>
```

#### Gradle dependency:

```kotlin
dependencies {
    implementation("com.ritense.valtimo:outbox")
}
```

## Configuration

The outbox can be configured to better match the environment:

#### **`application.yml`**

```yaml
valtimo:
  outbox:
    publisher:
      polling:
        rate: "PT1M" # ISO 8601 duration format. Default: PT10S
        batch-size: 10 # Number of messages to fetch and publish per poll cycle
        circuit-breaker:
          enabled: true # Enable/disable the circuit breaker
          failure-rate-threshold: 50 # Percentage of failures that triggers the circuit to open
          minimum-number-of-calls: 5 # Minimum calls before failure rate is evaluated
          sliding-window-size: 10 # Number of calls tracked for failure rate calculation
          wait-duration-in-open-state-seconds: 60 # How long the circuit stays open
          permitted-number-of-calls-in-half-open-state: 3 # Test calls allowed in half-open state
```

### Disabling the outbox

It is possible to disable the outbox functionality without having to remove the module. This is useful for environments where you might not want the overhead this module adds.\
When disabled, a no-operation `OutboxService` implementation bean will be used. This will be the only `outbox` bean available to the application.

The outbox will be disabled by setting the following application property:

```yaml
valtimo.outbox.enabled: false
```

### Suppressing the outbox for Object Management

Object management configurations support a `suppressOutbox` property that prevents outbox messages from being created
during object API calls. This is useful for read-heavy integrations where outbox overhead is unnecessary.

Set `suppressOutbox` to `true` in the object management JSON configuration:

```json
{
    "title": "my-objects",
    "objectenApiPluginConfigurationId": "...",
    "objecttypenApiPluginConfigurationId": "...",
    "objecttypeId": "...",
    "suppressOutbox": true
}
```
