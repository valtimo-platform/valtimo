# Connector

## Dependencies

In order to create and use connectors, the connector module needs to be added as a dependency. The following can be added to your project, depending on whether Maven or Gradle is used:

### Backend

The samples below assume the [valtimo-dependency-versions](valtimo-dependency-versions.md) module is used. If not, please specify the artifact version as well.

#### Maven dependency:

```xml
<dependencies>
    <dependency>
        <groupId>com.ritense.valtimo</groupId>
        <artifactId>connector</artifactId>
    </dependency>
</dependencies>
```

#### Gradle dependency:

```kotlin
dependencies {
  implementation("com.ritense.valtimo:connector")
}
```

## Configuration

In order to run the connector module, the `valtimo.connector-encryption.secret` property needs to be configured. The bare minimum that has to be added to the application properties is the following:

#### **`application.yml`**

```yaml
valtimo:
  connector-encryption:
    secret: "<your-value-goes-here>"
```
