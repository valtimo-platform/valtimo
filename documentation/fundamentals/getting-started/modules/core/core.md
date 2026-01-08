# Core

## Dependencies

In order to use Valtimo, the core module needs to be added as a dependency. The following can be added to your project, depending on whether Maven or Gradle is used:

### Backend

The samples below assume the [valtimo-dependency-versions](valtimo-dependency-versions.md) module is used. If not, please specify the artifact version as well.

#### Maven dependency:

```xml
<dependencies>
    <dependency>
        <groupId>com.ritense.valtimo</groupId>
        <artifactId>core</artifactId>
    </dependency>
</dependencies>
```

#### Gradle dependency:

```kotlin
dependencies {
  implementation("com.ritense.valtimo:core")
}
```

## Configuration

In order to run the web module, several properties need to be configured. The bare minimum that has to be added to the application properties is the following:

#### **`application.yml`**

```yaml
valtimo:
  jwt:
    base64encoding: false 
    tokenValidityInSeconds: 3600
    tokenValidityInSecondsForRememberMe: 2592000
    secret: "secret-goes-here"
```
