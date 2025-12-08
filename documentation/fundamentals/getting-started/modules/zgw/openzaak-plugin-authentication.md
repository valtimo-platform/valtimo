# OpenZaak Plugin Authentication

## Dependencies

In order to use the OpenZaak Plugin Authentication plugin, the `openzaak-plugin-authentication` module needs to be added as a dependency. The following can be added to your project, depending on whether Maven or Gradle is used:

### Backend

The samples below assume the [valtimo-dependency-versions](../core/valtimo-dependency-versions.md) module is used. If not, please specify the artifact version as well.

#### Maven dependency:

```xml
<dependencies>
    <dependency>
        <groupId>com.ritense.valtimo</groupId>
        <artifactId>openzaak-plugin-authentication</artifactId>
    </dependency>
</dependencies>
```

#### Gradle dependency:

```kotlin
dependencies {
  implementation("com.ritense.valtimo:openzaak-plugin-authentication")
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
