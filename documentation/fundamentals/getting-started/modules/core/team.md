# Team

The team module provides a way to group users and manage their membership.

## Dependencies

The team module is a transitive dependency of `case`, so no action should be necessary to enable the feature if the `case` module is used.

However, if more control is needed, the following can be added to your project:

### Backend

The samples below assume the [valtimo-dependency-versions](valtimo-dependency-versions.md) module is used. If not, please specify the artifact version as well.

#### Maven dependency:

```xml
<dependencies>
    <dependency>
        <groupId>com.ritense.valtimo</groupId>
        <artifactId>team</artifactId>
    </dependency>
</dependencies>
```

#### Gradle dependency:

```kotlin
dependencies {
  implementation("com.ritense.valtimo:team")
}
```
