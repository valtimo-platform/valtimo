# Documenten API

## Dependencies

In order to use the Documenten API, the Documenten API module needs to be added as a dependency. The following can be added to your project, depending on whether Maven or Gradle is used:

### Backend

The samples below assume the [valtimo-dependency-versions](../core/valtimo-dependency-versions.md) module is used. If not, please specify the artifact version as well.

#### Maven dependency:

```xml
<dependencies>
    <dependency>
        <groupId>com.ritense.valtimo</groupId>
        <artifactId>documenten-api</artifactId>
    </dependency>
</dependencies>
```

#### Gradle dependency:

```kotlin
dependencies {
  implementation("com.ritense.valtimo:documenten-api")
}
```

### Frontend

A general instruction to add a front-end plugin to the implementation can be found [here](../core/plugin.md#adding-a-front-end-plugin-to-the-implementation).

In order to use the Documenten API plugin in the frontend the following can be added to your `app.module.ts`:

```typescript
import { DocumentenApiPluginModule, documentenApiPluginSpecification } from '@valtimo/plugin';

@NgModule({
  imports: [
      DocumentenApiPluginModule,
  ],
  providers: [
      {
          provide: PLUGIN_TOKEN,
          useValue: [
              documentenApiPluginSpecification,
          ]
      }
  ]
})
```

Before the Documenten API plugin can be used, an authentication plugin is needed. One such authentication plugin is the OpenZaak plugin. Instructions on how to add the OpenZaak plugin can be found [here](broken-reference).
