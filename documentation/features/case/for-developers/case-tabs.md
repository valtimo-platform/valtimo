# Custom case tabs

When you want case tabs with functionality that is not covered by the other tab types you can create a custom Angular component that is used as a case tab. These Angular components have to be registered in the Angular application as a potential tab.

#### **`app.module.ts`**

```typescript
...
// import CASE_TAB_TOKEN
import { CASE_TAB_TOKEN } from '@valtimo/dossier';
...
// import your custom component from wherever you have defined it
import {CustomTabComponent} from 'component-path';
...

// add this to the providers array of the AppModule
...
    {
      provide: CASE_TAB_TOKEN,
      useValue: {
        'custom-tab-name': CustomTabComponent,
      },
    }
...
export class AppModule {
    ...
}
```
