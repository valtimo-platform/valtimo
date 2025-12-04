# Audit

## Dependencies

In order to audit actions, the audit module needs to be added as a dependency. The following can be added to your project, depending on whether Maven or Gradle is used:

### Backend

The samples below assume the [valtimo-dependency-versions](valtimo-dependency-versions.md) module is used. If not, please specify the artifact version as well.

#### Maven dependency:

```xml
<dependencies>
    <dependency>
        <groupId>com.ritense.valtimo</groupId>
        <artifactId>audit</artifactId>
    </dependency>
</dependencies>
```

#### Gradle dependency:

```kotlin
dependencies {
  implementation("com.ritense.valtimo:audit")
}
```
