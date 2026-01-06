# Custom display types

## Front-end

To develop a front-end for a display type, the library `@valtimo/dashboard` provides several interfaces which display type front-ends must conform to, in order to be used in an implementation.

### Display type specification

First, a display type specification conforming to the `DisplayTypeSpecification` interface needs to be created. Below is an example specification with explanations for each property:

#### **`sample-display-type.specification.ts`**

```typescript
import {DisplayTypeSpecification} from '@valtimo/dashboard';
import {SampleConfigurationComponent} from './components/sample-configuration/sample-configuration.component';
import {SampleDisplayComponent} from './components/sample-display/sample-display.component';

const sampleDisplayTypeSpecification: DisplayTypeSpecification = {
    // The display type key. This needs to be the same as the id received from the back-end.
    displayTypeKey: 'sample-display-type',
    // A component of the interface DisplayTypeConfigurationComponent, used to configure the display type
    configurationComponent: SampleConfigurationComponent,
    // A component of the interface DisplayComponent, used to configure the display type
    displayComponent: SampleDisplayComponent,
    // the width in squares the display type component will take up on the dashboard
    width: 1,
    // the height in squares the display type component will take up on the dashboard
    height: 1,
    /*
    each data source specifies what kind of data features it provides. Here you define what data features your
    display type requires, so that your display type can only be selected when a compatible data source is selected.
    */
    requiredDataFeatures: ['number'],
    /* 
    For each language key an implementation supports, translation keys with a translation are provided below. 
    These can then be used in configuration components using the widgetTranslate pipe or the WidgetTranslationService.
    At a minumum, the key 'title' needs to be defined.
     */
    translations: {
        nl: {
            title: 'Weergave',
            ...
        },
        en: {
            title: 'Display',
            ...
        },
        de: {
            title: 'Anzeige',
            ...
        },
    },
};

export {sampleDisplayTypeSpecification};
```

### Display type configuration component

As shown in the [display type specification section](custom-display-type.md#display-type-specification), display type configuration components need to conform to the interface `DisplayTypeConfigurationComponent`. Below the interface is shown, with a comment for each required property.

#### **`configuration.model.ts`**

```typescript
...

/* 
The required output. Each time the user input changes, it the new data must be emitted, and it must be emitted whether
this data is valid. The the data must conform to the properties expected by the back-end.
*/
interface ConfigurationOutput {
    valid: boolean;
    data: object;
}

/*
The generic interface for a configuration component.
All of these properties must be implemented by the display type configuration component,
since this interface is extended below.
*/
interface ConfigurationComponent {
    // if the disabled input is true, all component input must be disabled
    disabled: boolean;
    /*
    if the display type configuration is modified instead of created, a prefill configuration is passed. When this
    data is available, respond to it by prefilling the input components in your configuration component.
    */
    prefillConfiguration?: object;
    /*
    Each time the values of the inputs in your configuration component change, emit this new value and whether the
    configuration as a whole is valid through this event emitter.
     */
    configurationEvent: EventEmitter<ConfigurationOutput>;
}

...

interface DisplayTypeConfigurationComponent extends ConfigurationComponent {
    /*
    Next to the properties supported by the configuration component, the display type key is available to a display type
    configuration component. This is mainly used for translating text inside the component.
     */
    displayTypeKey: string;
}

...
```

### Typing display type configuration data

As mentioned, the display type configuration component accepts prefill data. This prefill data is equal to the display type properties saved in the back-end. Next to this, the display component accepts data. It is advised to also type the way in this data is received.

#### **`sample.model.ts`**

```typescript
interface SampleDisplayTypeData {
    size: number;
}

interface SampleDisplayTypeProperties {
    title: string;
}

export {SampleDisplayTypeData, SampleDisplayTypeProperties};
```

### Implementing the display type configuration component

How a configuration component for the sample display type can be implemented is shown below. The way this is implemented can differ, as long as the interfaces are conformed to. Below is sample code of implementing the component using Carbon components and [reactive forms](https://angular.io/guide/reactive-forms).

#### **`sample-display-type-configuration.component.ts`**

```typescript
...
import {SampleDisplayTypeProperties} from '../models';

@Component({
    templateUrl: './sample-display-type-configuration.component.html',
    styleUrls: ['./sample-display-type-configuration.component.scss'],
})
export class SampleDisplayTypeConfigurationComponent
    // The component explicitly implements the DisplayTypeConfigurationComponent interface
    implements DisplayTypeConfigurationComponent, OnInit, OnDestroy
{
    // the display type key defined in the specification is passed to the component
    @Input() public displayTypeKey: string;

    // a form group is created which fits the SampleDisplayTypeProperties interface
    public readonly form = this.fb.group({
        title: this.fb.control(null, [Validators.required]),
    });

    // the form group is enabled or disabled based on the disabled input
    @Input() public set disabled(disabledValue: boolean) {
        if (disabledValue) {
            this.form.disable();
        } else {
            this.form.enable();
        }
    }
    
    // getting the specific title field from the form group
    public get title() {
        return this.form.get('title');
    }

    // setting the prefill configuration value in the form group if it exists as an input
    @Input() set prefillConfiguration(configurationValue: SampleDisplayTypeProperties) {
        if (configurationValue) {
            this.title.setValue(configurationValue.title)
        }
    }

    // defining the configuration event emitter as required by the DisplayTypeConfigurationComponent interface
    @Output() public configurationEvent = new EventEmitter<ConfigurationOutput>();

    // initializing a subscription object
    private _subscriptions = new Subscription();
    
    ...

    // subscribe to the form value on init
    public ngOnInit(): void {
        this.openFormSubscription();
    }
    
    // unsubcribe from form value on destroy
    public ngOnDestroy(): void {
        this._subscriptions.unsubscribe();
    }

    private openFormSubscription(): void {
        this._subscriptions.add(
            /*
            on form value changes, output value and whether it is valid. startWith is used to fire the observable
            with the initial value, before any changes are made
             */
            this.form.valueChanges.pipe(startWith(this.form.value)).subscribe((formValue) => {
                this.configurationEvent.emit({
                    valid: this.form.valid,
                    data: formValue,
                });
            })
        );
    }
}
```

The corresponding template file looks like this:

#### **`sample-display-type-configuration.component.html`**

```angular2html
<form [formGroup]="form">
    <cds-label
    <!-- To display translated text from the specification, the widget translate pipe is used. This is explained more below -->
    [helperText]="'titleHelperText' | widgetTranslate : displayTypeKey | async"
    [invalidText]="'titleHelperText' | widgetTranslate : displayTypeKey | async"
    [invalid]="title.dirty && title.invalid"
    >
        {{ 'title' | widgetTranslate : displayTypeKey | async }}
        <input cdsText formControlName="title" [invalid]="title.dirty && title.invalid" />
    </cds-label>
</form>
```

### Implementing the display component

Previously, a component was defined which configures the display type. Next, a separate component is defined to display the display type + data source configuration on the dashboard. An example of such a display component is shown below.

An example of the component code:

#### **`sample-display.component.ts`**

```typescript
....

@Component({
  templateUrl: './sample-display.component.html',
  styleUrls: ['./sample-display.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// the display component explicitly implements the DisplayComponent interface
export class SampleDisplayComponent implements DisplayComponent {
  /*
  each display component receives the display type key from the corresponding specification as an input. This key may
  be used to access widget translations, as explained in the section below
  */
  @Input() displayTypeKey: string;
  /*
  the display component receives the data from the back-end to an input, which conforms to the previously defined
  interface SampleDisplayTypeData
   */
  @Input() data: SampleDisplayTypeData;
  /*
  the display component receives the display type properties as an input, which conforms to the previously defined
  interface SampleDisplayTypeProperties
   */
  @Input() displayTypeProperties: SampleDisplayTypeProperties;
}

```

An example of the template code:

#### **`sample-display.component.html`**

```angular2html
<div class="sample-display">
    <!-- the title property from the display type properties is accessed in the template -->
    <span class="sample-display__title">{{displayTypeProperties?.title}}</span>
    <!-- the size property from the resolved data is accessed in the template -->
    <span class="sample-display__value">{{data?.size}}</span>
</div>
```

### Translation

Please refer to [this page](widget-translations.md) on how to implement translations from your specification in template or component code.

### Display type module

Finally, having defined a specification, configuration component and display component, we can construct a module. Keep to the below guidelines in constructing your module. When you finally import this module into the `AppModule` of your implementation, the display type configuration component should be available in the relevant configuration menus in your front-end, and the data source + display type configuration is displayed on your dashboard.

#### **`sample-display-type.module.ts`**

```typescript
...
import {DISPLAY_TYPE_TOKEN} from '@valtimo/dashboard';
import {sampleDisplayTypeSpecification} from './sample-display-type.specification';
...

@NgModule({
    // the configuration component and display component are declared
    declarations: [SampleDisplayTypeConfigurationComponent, SampleDisplayComponent],
    imports: [CommonModule, WidgetTranslatePipeModule, ...],
    // the configuration component and display component are exported
    exports: [SampleDisplayTypeConfigurationComponent, SampleDisplayComponent],
    providers: [
        /*
        The specification is provided as a value to the DISPLAY_TYPE_TOKEN imported from `@valtimo/dashboard`.
        This makes it available in your implementation. Make sure to set the `multi` option to `true` like below.
         */
        {provide: DISPLAY_TYPE_TOKEN, useValue: sampleDisplayTypeSpecification, multi: true},
    ],
})
export class SampleDisplayTypeModule {}
```
