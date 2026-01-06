# Custom form flow component

Sometimes it is not possible to capture the requirements for a form in Form.io. In cases like this you can create a custom front-end component.

Any Angular component can be used as a step in a form flow. Handling the form needs to be done in the component as well. To submit the data for the step, and go to the next step a `POST` call needs to be done to the `/api/v1/form-flow/{formFlowId}/step/{stepInstanceId}` endpoint. By providing a JSON body for this request, submission data can be stored for use in form flow.

## Registering a custom component

The component needs to be registered in the angular application so that the form flow framework can use it. Registering is done by adding a reference to the component to the providers array in the angular application. The `FORM_FLOW_COMPONENT_TOKEN` injection token can be provided with an array of component registrations. Each one contains an `id` that is used to reference the component from the form flow configuration, and the `component` property that contains the component. The injection token `FORM_FLOW_COMPONENT_TOKEN` can be found in the `@valtimo/form-link` package.

#### **`app.module.ts`**

```typescript
...
// import FORM_FLOW_COMPONENT_TOKEN
import { FORM_FLOW_COMPONENT_TOKEN } from '@valtimo/form-link';
...
// import your custom component from wherever you have defined it
import {SomeCustomComponent} from 'component-path';
...

// add this to the providers array of the AppModule
...
providers: [
  {
    provide: FORM_FLOW_COMPONENT_TOKEN,
    useValue: [
      {
        id: 'some-component-id',
        component: SomeCustomComponent,
      }
    ]
  }
]
...
export class AppModule {
    ...
}
```

## Using a custom component in a form flow

After a component has been registered in the front-end, it can be referenced in a form flow configuration. By using the step type `custom-component` a custom component can be used for that step. In the type properties the `componentId` needs to be set to the id of the component as registered in the angular application.

```json
    ...
      "type": {
        "name": "custom-component",
        "properties": {
          "componentId": "some-component-id"
        }
      }
    ...
```
