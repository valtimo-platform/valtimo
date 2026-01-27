# Register Angular component

By registering custom Angular components in the Valtimo front-end implementation these components can be used within 
case widgets. The output of the component will be displayed as the content of a widget.

## Register component

The custom component widget is meant to display any custom Angular component that you may need. There is a prerequisite 
for being able to configure this kind of widget. You need to register your custom component through our injection token 
available in _@valtimo/layout_.

In order to do this the following needs to be added to the app.module file in the codebase of the front-end implementation.

**Module:**\
`sample.app.module.ts`

**Configuration:**

```typescript
...
import {CUSTOM_WIDGET_TOKEN} from '@valtimo/layout';
import {ExampleCustomWidgetComponent} from 'custom-widget-component-path';
...

@NgModule({
  ...
  providers: [
    {
      provide: CUSTOM_WIDGET_TOKEN,
      useValue: {
        caseWidgetComponent: ExampleCustomWidgetComponent,
      },
    },
  ],
})
export class SampleAppModule
```

**Example of a custom component:**

Below is an example of a custom component. The `widgetConfiguration` property is always injected by the custom-widget 
component and contains the configuration of the custom-widget.

The `category` and `status` are additional input properties specific for this custom component, if the component does not 
need them, don't define them. The values for these properties need to be specified via the custom-widgets configuration 
'custom key-value pairs' collection.

```typescript
import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {ActivatedRoute, ParamMap} from '@angular/router';
import {NGXLogger} from 'ngx-logger';
import {CustomWidget} from '@valtimo/layout';

@Component({
  standalone: true,
  selector: 'app-example-custom-widget',
  templateUrl: './example-custom-widget.component.html',
  styleUrls: ['./example-custom-widget.component.scss'],
  imports: []
})
export class ExampleCustomWidgetComponent implements OnChanges {
  @Input() public widgetConfiguration: CustomWidget | null = null;

  // Additional input properties which are specific for this custom component.
  // If the custom component does not needed them, don't define them.
  @Input() public category: string | null = null;
  @Input() public status: string | null = null;

  public readonly caseDefinitionKey: string;
  public readonly documentId: string;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly logger: NGXLogger,
  ) {
    const _snapshot: ParamMap = this.route.snapshot.paramMap;

    this.caseDefinitionKey = _snapshot.get('caseDefinitionKey') || '';
    this.documentId = _snapshot.get('documentId') || '';

    this.logger.debug('ExampleCustomWidgetComponent > constructor');
    this.logger.debug('>> caseDefinitionKey', this.caseDefinitionKey);
    this.logger.debug('>> documentId', this.documentId);
  }

  public ngOnChanges(changes: SimpleChanges): void {
    this.logger.debug('ExampleCustomWidgetComponent > ngOnChanges', changes);
    this.logger.debug('>> widgetConfiguration', this.widgetConfiguration);
    this.logger.debug('>> category', this.category);
    this.logger.debug('>> status', this.status);
  }
}
```
