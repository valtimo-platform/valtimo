# Valtimo dependencies

## Dependencies

In order to create an implementation, the Valtimo dependencies module can be added as a dependency. This includes the most common modules that are used by Valtimo implementations. The following can be added to your project, depending on whether Maven or Gradle is used:

### Backend

The samples below assume the [valtimo-dependency-versions](valtimo-dependency-versions.md) module is used. If not, please specify the artifact version as well.

#### Maven dependency:

```xml
<dependencies>
    <dependency>
        <groupId>com.ritense.valtimo</groupId>
        <artifactId>valtimo-dependencies</artifactId>
    </dependency>
</dependencies>

```

#### Gradle dependency:

```kotlin
dependencies {
  implementation("com.ritense.valtimo:valtimo-dependencies")
}
```

## Configuration

Please check the individual pages of the individual dependencies for any required configuration:

* [Audit](audit.md)
* [Authorization](authorization.md)
* [Case](case.md)
* Changelog
* [Connector](broken-reference)
* [Contract](contract.md)
* [Core](core.md)
* [Dashboard](dashboard.md)
* Data provider
* [Document](broken-reference)
* [Exporter](exporter.md)
* [Form](form.md)
* [Form flow](form-flow.md)
* [Form flow Valtimo](form-flow-valtimo.md)
* [Importer](importer.md)
* Keycloak IAM
* Notes
* Plugin
* [Plugin Valtimo](plugin.md)
* [Process document](process-document.md)
* Process link
* [Temporary resource storage](temporary-resource-storage.md)
* Search
* [Value resolver](value-resolver.md)
* [Web](web/)
