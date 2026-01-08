# OpenZaak

> _**NOTE:**_ This module has been deprecated.

## Dependencies

In order to use OpenZaak, the OpenZaak module needs to be added as a dependency. The following can be added to your project, depending on whether Maven or Gradle is used:

> _**NOTE:**_ The OpenZaak module has been deprecated.
>
> The OpenZaakPlugin can now be found in the [openzaak-plugin-authentication](openzaak-plugin-authentication.md) module.

### Backend

The samples below assume the [valtimo-dependency-versions](../core/valtimo-dependency-versions.md) module is used. If not, please specify the artifact version as well.

#### Maven dependency:

```xml
<dependencies>
    <dependency>
        <groupId>com.ritense.valtimo</groupId>
        <artifactId>openzaak</artifactId>
    </dependency>
</dependencies>
```

#### Gradle dependency:

```kotlin
dependencies {
  implementation("com.ritense.valtimo:openzaak")
}
```

### Using plugins

When a plugin is implemented in your project, the Openzaak module needs three additional dependencies:

* DocumentenApiAuthentication
* ZakenApiAuthentication
* CatalogiApiAuthentication

For this, the following needs to be added to your project:

#### Maven dependency:

```xml
<dependencies>
    <dependency>
        <groupId>com.ritense.valtimo</groupId>
        <artifactId>documenten-api</artifactId>
    </dependency>
    <dependency>
        <groupId>com.ritense.valtimo</groupId>
        <artifactId>zaken-api</artifactId>
    </dependency>
    <dependency>
        <groupId>com.ritense.valtimo</groupId>
        <artifactId>catalogi-api</artifactId>
    </dependency>
</dependencies>
```

#### Gradle dependency:

```kotlin
dependencies {
  implementation("com.ritense.valtimo:documenten-api")
  implementation("com.ritense.valtimo:zaken-api")
  implementation("com.ritense.valtimo:catalogi-api")
}
```

### Frontend

A general instruction to add a front-end plugin to the implementation can be found [here](../core/plugin.md#adding-a-front-end-plugin-to-the-implementation).

In order to use the OpenZaak plugin in the frontend, the following can be added to your `app.module.ts`:

```typescript
import { OpenZaakPluginModule, openZaakPluginSpecification } from '@valtimo/plugin';

@NgModule({
  imports: [
      OpenZaakPluginModule,
  ],
  providers: [
      {
          provide: PLUGIN_TOKEN,
          useValue: [
              openZaakPluginSpecification,
          ]
      }
  ]
})
```
