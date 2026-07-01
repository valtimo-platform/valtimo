# Registering the Object Management Select component

The Object Management Select component must be registered in your Angular application before it can be used in forms.

## Registration

Import and call the registration function in your `AppModule` constructor:

```typescript
import { registerObjectManagementSelectFormioComponent } from '@valtimo/components';

@NgModule({...})
export class AppModule {
  constructor(injector: Injector) {
    // Other registrations...
    registerObjectManagementSelectFormioComponent(injector);
  }
}
```

The component is then available in the Form.io builder under the "Advanced" group.

## Exported symbols

The following symbols are exported from `@valtimo/components`:

| Symbol | Type | Description |
|--------|------|-------------|
| `registerObjectManagementSelectFormioComponent` | Function | Registers the component with Form.io |
| `ObjectManagementSelectComponent` | Component | The Angular component class |
| `ObjectManagementSelectService` | Service | HTTP service for fetching objects |
| `ObjectManagementSelectValue` | Interface | Type for stored selection values |
| `ColumnFilterConfig` | Interface | Type for column configuration |
| `DropdownOption` | Interface | Type for a dropdown filter option (`value`/`label`) |
| `ObjectsPage` | Interface | Type for the paginated objects response |
| `ObjectWrapper` | Interface | Type for a single object returned by the Objecten API |
