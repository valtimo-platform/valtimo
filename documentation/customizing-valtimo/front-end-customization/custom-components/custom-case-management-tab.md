---
description: >-
  If you would like to add a custom tab to the case management page for a
  specific case type, you can register a custom component for this in the app
  module.
---

# Custom case management tab

#### **`app.module.ts`**

```typescript
...
// import CASE_MANAGEMENT_TAB_TOKEN
import { CASE_MANAGEMENT_TAB_TOKEN } from '@valtimo/config';
...
// import your custom component from wherever you have defined it
import {CustomTabComponent} from 'component-path';
...

// add this to the providers array of the AppModule
...
     {
      provide: CASE_MANAGEMENT_TAB_TOKEN,
      useValue: {
        // this refers to a translation key in the translation json files
        translationKey: 'translations.customTabTitle',
        component: CustomTabComponent,
      },
      multi: true,
    },
...
export class AppModule {
    ...
}
```
