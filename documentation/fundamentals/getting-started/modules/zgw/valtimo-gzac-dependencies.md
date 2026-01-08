# Valtimo GZAC dependencies

## Dependencies

In order to create an implementation using the GZAC edition, the Valtimo GZAC dependencies module can be added as a dependency. This includes the most common modules that are used by Valtimo GZAC implementations, including the [Valtimo dependencies](../core/valtimo-dependencies.md). The following can be added to your project, depending on whether Maven or Gradle is used:

### Backend

The samples below assume the [valtimo-dependency-versions](../core/valtimo-dependency-versions.md) module is used. If not, please specify the artifact version as well.

#### Maven dependency:

```xml
<dependencies>
    <dependency>
        <groupId>com.ritense.valtimo</groupId>
        <artifactId>valtimo-gzac-dependencies</artifactId>
    </dependency>
</dependencies>

```

#### Gradle dependency:

```kotlin
dependencies {
  implementation("com.ritense.valtimo:valtimo-gzac-dependencies")
}
```

### Dependencies

The following modules are added when a dependency on Valtimo GZAC dependencies is added:

* [Valtimo dependencies](../core/valtimo-dependencies.md)
* [Besluiten API](besluiten-api.md)
* [Catalogi API](catalogi-api.md)
* [Documenten API](documenten-api.md)
* [Haalcentraal BRP](broken-reference)
* [Notificaties API](notificaties-api.md)
* [Notificaties API authentication](notificaties-api-authentication.md)
* [Object management](object-management.md)
* [Objecten API](objecten-api.md)
* [Objecten API authentication](objecten-api-authentication.md)
* [Objecttypen API](objecttypen-api.md)
* [Portaaltaak](portaaltaak.md)
* [Verzoek](verzoek.md)
* [Zaken API](zaken-api.md)
