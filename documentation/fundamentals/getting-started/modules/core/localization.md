# Localization

## Dependencies

In order to support user configurable localization, the localization module needs to be added as a dependency. The following can be added to your project, depending on whether Maven or Gradle is used:

### Backend

#### Maven dependency:

```xml
<dependencies>
    <dependency>
        <groupId>com.ritense.valtimo</groupId>
        <artifactId>localization</artifactId>
        <version>${valtimo_version}</version>
    </dependency>
</dependencies>
```

#### Gradle dependency:

```groovy
dependencies {
    implementation "com.ritense.valtimo:localization:${valtimo_version}"
}
```
