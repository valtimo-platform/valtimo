# Objecttypen API

## Dependencies

In order to use the Objecttypen API, the Objecttypen API module needs to be added as a dependency. The following can be added to your project, depending on whether Maven or Gradle is used:

### Backend

The samples below assume the [valtimo-dependency-versions](../core/valtimo-dependency-versions.md) module is used. If not, please specify the artifact version as well.

#### Maven dependency:

```xml
<dependencies>
    <dependency>
        <groupId>com.ritense.valtimo</groupId>
        <artifactId>objecttypen-api</artifactId>
    </dependency>
</dependencies>
```

#### Gradle dependency:

```kotlin
dependencies {
  implementation("com.ritense.valtimo:objecttypen-api")
}
```

### Frontend

A general instruction to add a front-end plugin to the implementation can be found [here](../core/plugin.md#adding-a-front-end-plugin-to-the-implementation).

In order to use the Object Typen API plugin in the frontend the following can be added to your `app.module.ts`:

```typescript
import { ObjecttypenApiPluginModule, objecttypenApiPluginSpecification } from '@valtimo/plugin';

@NgModule({
  imports: [
      ObjecttypenApiPluginModule,
  ],
  providers: [
      {
          provide: PLUGIN_TOKEN,
          useValue: [
              objecttypenApiPluginSpecification,
          ]
      }
  ]
})
```

Before the Object Typen API plugin can be used, an authentication plugin is needed. One such authentication plugin is the Objecten API authentication plugin. Instructions on how to add this plugin can be found [here](objecten-api-authentication.md).
