# Document Verzoek

This plugin makes it possible for GZAC to receive a notification that a Document is added to a GZAC Zaak in an external application (e.g. KOFAX).

## Dependencies

In order to use the Document Verzoek plugin, the Document Verzoek module needs to be added as a dependency. The following can be added to your project, depending on whether Maven or Gradle is used:

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
import { DocumentVerzoekPluginModule, documentVerzoekPluginSpecification } from '@valtimo/plugin';

@NgModule({
  imports: [
      DocumentVerzoekPluginModule,
  ],
  providers: [
      {
          provide: PLUGIN_TOKEN,
          useValue: [
              documentVerzoekPluginSpecification,
          ]
      }
  ]
})
```
