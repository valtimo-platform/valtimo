---
description: >-
  A UI component process link renders a custom Angular component instead of a
  Form.io form, giving full control over the user interface for user tasks and
  start events.
---

# Custom UI component process link

To use a UI component process link, register a custom Angular component that implements the `FormCustomComponent` interface from `@valtimo/process-link`:

```typescript
interface FormCustomComponent {
  taskInstanceId: string | null;
  processDefinitionKey: string | null;
  documentDefinitionName: string | null;
  documentId: string | null;
  submittedEvent: EventEmitter<any>;
}
```

The component receives `taskInstanceId` (for user tasks), `processDefinitionKey`, `documentDefinitionName`, and `documentId` as inputs, and must emit `submittedEvent` when the user completes the form.

For user tasks, the custom component is responsible for completing the task on the backend (e.g. by calling `TaskService.completeTask()`). After emitting `submittedEvent`, the platform will show a success toast, close the modal, and refresh the task list.

Register the component in your app module using the `FORM_CUSTOM_COMPONENT_TOKEN`:

#### **`app.module.ts`**

```typescript
...
// import FORM_CUSTOM_COMPONENT_TOKEN
import { FORM_CUSTOM_COMPONENT_TOKEN } from '@valtimo/process-link';
...
// import your custom component from wherever you have defined it
import { MyCustomComponent } from 'component-path';
...

// add this to the providers array of the AppModule
...
{
  provide: FORM_CUSTOM_COMPONENT_TOKEN,
  useValue: {
    'my-custom-component': MyCustomComponent,
  },
},
...
export class AppModule {
    ...
}
```

The key `'my-custom-component'` is the identifier you will select when configuring the UI component process link in the admin UI or in the auto-deployment JSON. See [Process links](../../../features/process/process-link.md) for more information on configuring process links.
