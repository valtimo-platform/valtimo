# Plugins

## Dependencies

In order to use plugins or create custom plugin definitions, the plugin module needs to be added as a dependency. The following can be added to your project, depending on whether Maven or Gradle is used:

### Backend

The samples below assume the [valtimo-dependency-versions](valtimo-dependency-versions.md) module is used. If not, please specify the artifact version as well.

#### Maven dependency:

```xml
<dependencies>
    <dependency>
        <groupId>com.ritense.valtimo</groupId>
        <artifactId>plugin-valtimo</artifactId>
    </dependency>
</dependencies>
```

#### Gradle dependency:

```kotlin
dependencies {
    implementation("com.ritense.valtimo:plugin-valtimo")
}
```

### Frontend

```json
{
  "dependencies": {
    "@valtimo/plugin-management": "*.*.*",
    "@valtimo/plugin": "*.*.*"
  }
}
```

#### Adding a front-end plugin to the implementation

For each plugin configured in the backend, the frontend implementation needs to know what components to use in order to configure the plugin, and to configure the plugin's actions.

The library `@valtimo/plugin` exports several pre-made plugins. In order to use these in the implementation, the plugin's module and the plugin's specification need to be imported into the app module. Also, `PLUGINS_TOKEN` needs to be imported to inject the specification.

For example:

#### **`app.module.ts`**

```typescript
...

import {
    PLUGINS_TOKEN,
    SmartDocumentsPluginModule,
    smartDocumentsPluginSpecification
} from '@valtimo/plugin';

...
```

Next, add the plugin module to the `imports` array of the app module, and add the specification to the array provided by `PLUGINS_TOKEN` under the `providers` array in the app module.

For example:

#### **`app.module.ts`**

```typescript
...

@NgModule({
    ...
    imports: [
        ...
        SmartDocumentsPluginModule
    ],
    providers: [
        ...
        {
            provide: PLUGINS_TOKEN,
            useValue: [
                ...
                smartDocumentsPluginSpecification
            ],
        },
    ],
    ...
})
export class AppModule {
}
```

The implementation should now be able to display the plugin, configure it, configure its actions, and be able to link its actions to process activities.
