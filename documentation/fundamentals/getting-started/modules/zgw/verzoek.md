# Verzoek

This plugin makes it possible for Valtimo to create a Valtimo case with a GZAC zaak when a notification is received from the Notificaties API.

## Dependencies

In order to use the Verzoek plugin, the Verzoek module needs to be added as a dependency. The following can be added to your project, depending on whether Maven or Gradle is used:

### Backend

The samples below assume the [valtimo-dependency-versions](../core/valtimo-dependency-versions.md) module is used. If not, please specify the artifact version as well.

#### Maven dependency:

```xml

<dependencies>
    <dependency>
        <groupId>com.ritense.valtimo</groupId>
        <artifactId>verzoek</artifactId>
    </dependency>
</dependencies>
```

#### Gradle dependency:

```kotlin
dependencies {
    implementation("com.ritense.valtimo:verzoek")
}
```

### Frontend

A general instruction to add a front-end plugin to the implementation can be found [here](../core/plugin.md#adding-a-front-end-plugin-to-the-implementation).

In order to use the Verzoek plugin in the frontend, the following can be added to your `app.module.ts`:

```typescript
import { VerzoekPluginModule, verzoekPluginSpecification } from '@valtimo/plugin';

@NgModule({
  imports: [
      VerzoekPluginModule,
  ],
  providers: [
      {
          provide: PLUGIN_TOKEN,
          useValue: [
              verzoekPluginSpecification,
          ]
      }
  ]
})
```
