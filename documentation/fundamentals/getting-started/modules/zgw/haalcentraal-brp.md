# Haalcentraal BRP

> _**NOTE:**_ This module has been deprecated. Will be replaced by new plugins in the future.

## Dependencies

In order to connect to the Haalcentraal BRP, the Haalcentraal BRP module needs to be added as a dependency. The following can be added to your project, depending on whether Maven or Gradle is used:

### Backend

The samples below assume the [valtimo-dependency-versions](../core/valtimo-dependency-versions.md) module is used. If not, please specify the artifact version as well.

#### Maven dependency:

```xml
<dependencies>
    <dependency>
        <groupId>com.ritense.valtimo</groupId>
        <artifactId>haalcentraal-brp</artifactId>
    </dependency>
</dependencies>
```

#### Gradle dependency:

```kotlin
dependencies {
  implementation("com.ritense.valtimo:haalcentraal-brp")
}
```
