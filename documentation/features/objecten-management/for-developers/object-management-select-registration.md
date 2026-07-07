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
