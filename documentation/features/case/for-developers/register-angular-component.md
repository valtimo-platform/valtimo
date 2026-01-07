# Register Angular component

By registering custom Angular components in the Valtimo front-end implementation these components can be used withing case widgets. The output of the component will be displayed as the content of a widget.\


## Register component

The custom component widget is meant to display any custom Angular component that you may need. There is a prerequisite for being able to configure this kind of widget. You need to register your custom component through our injection token available in _@valtimo/dossier_.

In order to do this the following needs to be added to the app.module file in the codebase of the front-end implementation.

**Module:**\
`sample.app.module.ts`

**Configuration:**

```
...
import {CUSTOM_CASE_WIDGET_TOKEN} from '@valtimo/dossier';
import {ExampleCustomComponent} from 'custom-component-path';
...
@NgModule({
  ...
  providers:[
  {
   provide: CUSTOM_CASE_WIDGET_TOKEN,
   useValue: {
     caseWidgetComponent: ExampleCustomComponent,
     },
  },
 ]
})
export class SampleAppModule
```
