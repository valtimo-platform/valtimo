# Klant

> _**NOTE:**_ This module has been deprecated. Will be replaced by new plugins in the future.

## Dependencies

In order to connect to the Klanten API, the klant module needs to be added as a dependency. The following can be added to your project, depending on whether Maven or Gradle is used:

### Backend

The samples below assume the [valtimo-dependency-versions](../core/valtimo-dependency-versions.md) module is used. If not, please specify the artifact version as well.

#### Maven dependency:

```xml
<dependencies>
    <dependency>
        <groupId>com.ritense.valtimo</groupId>
        <artifactId>klant</artifactId>
    </dependency>
</dependencies>
```

#### Gradle dependency:

```kotlin
dependencies {
  implementation("com.ritense.valtimo:klant")
}
```

## Configuration

In order to run the klant module, several properties can be configured. The bare minimum that has to be added to the application properties is the following:

#### **`application.yml`**

```yaml
valtimo:
  openklant:
    url:
    client-id:
    secret: 
    rsin: 
```
