# Wordpress mail

## Dependencies

In order to connect to the Wordpress API, the Wordpress mail module needs to be added as a dependency. The following can be added to your project, depending on whether Maven or Gradle is used:

### Backend

The samples below assume the [valtimo-dependency-versions](../core/valtimo-dependency-versions.md) module is used. If not, please specify the artifact version as well.

#### Maven dependency:

```xml
<dependencies>
    <dependency>
        <groupId>com.ritense.valtimo</groupId>
        <artifactId>wordpress-mail</artifactId>
    </dependency>
</dependencies>
```

#### Gradle dependency:

```kotlin
dependencies {
  implementation("com.ritense.valtimo:wordpress-mail")
}
```
