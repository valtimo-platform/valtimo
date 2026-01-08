# Custom data sources

## Back-end

The dependency `com.ritense.valtimo:dashboard` is required to develop a data source in the Valtimo back-end.

### Data source specification

Data source specifications can be created using the `@WidgetDataSource` on a method in a Spring bean. Below is an example data source:

```kotlin
@Component
class RandomNumberWidgetDataSource {

    @WidgetDataSource(key = "randomNumber", title = "Random number")
    fun randomNumberDataSource(properties: RandomNumberDataSourceProperties): RandomNumberResult {
        return RandomNumberResult(Random.nextInt(properties.from, properties.to))
    }
}
```

Please keep the following in mind:

* The new data source should be registered as a Spring bean, for example with an `@Bean` or `@Component` annotation
* The data source key (in this example `randomNumber`) must be unique and is used the identify the data source. The same key must also be used in the front end data source.
* The function can be named anything.

### Data source properties

If the datasource requires any configuration this will be passed in through the arguments of the function. All properties should be contained in a single object that is used as the argument for this function. The configuration from the front-end will be deserialized to this type, so the json structure should match that of the object. If no configuration is required the argument can be left out. Below is an example of a properties object that can be passed to the data source function.

```kotlin
data class RandomNumberDataSourceProperties(
    val from: Long = 0,
    val to: Long = 10
)
```

The function return value can be an object that contains anything. But ideally uses one of the following interfaces:

* `HasLabel`
* `HasNumberValue`
* `HasNumberValues`
* `HasTotal`

For example:

```kotlin
data class RandomNumberResult(
    override val value: Long
) : HasNumberValue
```

## Front-end

To develop a front-end for a data source, the library `@valtimo/dashboard` provides several interfaces which data source front-ends must conform to, in order to be used in an implementation.

### Data source specification

First, a data source specification conforming to the `DataSourceSpecification` interface needs to be created. Below is an example specification with explanations for each property:

#### **`sample-data-source.specification.ts`**

```typescript
import {DataSourceSpecification} from '@valtimo/dashboard';
import {SampleConfigurationComponent} from './components/sample-configuration/sample-configuration.component';

const sampleDataSourceSpecification: DataSourceSpecification = {
    // The data source key. This needs to be the same as the id received from the back-end.
    dataSourceKey: 'sample-data-source',
    // A component of the interface DataSourceConfigurationComponent, used to configure the data source.
    configurationComponent: SampleConfigurationComponent,
    /* 
    For each language key an implementation supports, translation keys with a translation are provided below. 
    These can then be used in configuration components using the widgetTranslate pipe or the WidgetTranslationService.
    At a minumum, the key 'title' needs to be defined.
     */
    translations: {
        nl: {
            title: 'Databron',
            ...
        },
        en: {
            title: 'Data source',
            ...
        },
        de: {
            title: 'Datenquelle',
            ...
        },
    },
};

export {sampleDataSourceSpecification};
```

### Plugin configuration component

As shown in the [data source specification section](custom-data-source.md#data-source-specification), data source configuration components need to conform to the interface `DataSourceConfigurationComponent`. Below the interface is shown, with a comment for each required property.

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
All of these properties must be implemented by the data source configuration component,
since this interface is extended below.
*/
interface ConfigurationComponent {
    // if the disabled input is true, all component input must be disabled
    disabled: boolean;
    /*
    if the data source configuration is modified instead of created, a prefill configuration is passed. When this
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

interface DataSourceConfigurationComponent extends ConfigurationComponent {
    /*
    Next to the properties supported by the configuration component, the data source key is available to a data
    source configuration component. This is mainly used for translating text inside the component.
     */
    dataSourceKey: string;
}

...
```

### Typing data source configuration data

As mentioned, the data source configuration component accepts prefill data. It is advised to further specify what data the data source requires. For the sample data source, this would be:

#### **`sample.model.ts`**

```typescript
interface SampleDataSourceConfig {
    documentDefinition: string;
}

export {SampleDataSourceConfig};
```

### Implementing the data source configuration component

How a configuration component for the sample data source can be implemented is shown below. The way this is implemented can differ, as long as the interfaces are conformed to. Below is sample code of implementing the component using Carbon components and [reactive forms](https://angular.io/guide/reactive-forms).

#### **`sample-data-source-configuration.component.ts`**

```typescript
...
import {SampleDataSourceConfig} from '../models';

@Component({
    templateUrl: './sample-data-source-configuration.component.html',
    styleUrls: ['./sample-data-source-configuration.component.scss'],
})
export class SampleDataSourceConfigurationComponent
    // The component explicitly implements the DataSourceConfigurationComponent interface
    implements DataSourceConfigurationComponent, OnInit, OnDestroy
{
    // the data source key defined in the specification is passed to the component
    @Input() public dataSourceKey: string;

    // a form group is created which fits the SampleDataSourceConfig interface
    public readonly form = this.fb.group({
        documentDefinition: this.fb.control(null, [Validators.required]),
    });

    // the form group is enabled or disabled based on the disabled input
    @Input() public set disabled(disabledValue: boolean) {
        if (disabledValue) {
            this.form.disable();
        } else {
            this.form.enable();
        }
    }
    
    // getting the specific document definition field from the form group
    public get documentDefinition() {
        return this.form.get('documentDefinition');
    }

    // setting the prefill configuration value in the form group if it exists as an input
    @Input() set prefillConfiguration(configurationValue: SampleDataSourceConfig) {
        if (configurationValue) {
            this.documentDefinition.setValue(configurationValue.documentDefinition)
        }
    }

    // defining the configuration event emitter as required by the DataSourceConfigurationComponent interface
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

#### **`sample-data-source-configuration.component.html`**

```angular2html
<form [formGroup]="form">
    <cds-label
    <!-- To display translated text from the specification, the widget translate pipe is used. This is explained more below -->
    [helperText]="'documentDefinitionHelperText' | widgetTranslate : dataSourceKey | async"
    [invalidText]="'documentDefinitionHelperText' | widgetTranslate : dataSourceKey | async"
    [invalid]="documentDefinition.dirty && documentDefinition.invalid"
    >
        {{ 'documentDefinition' | widgetTranslate : dataSourceKey | async }}
        <input cdsText formControlName="documentDefinition" [invalid]="documentDefinition.dirty && documentDefinition.invalid" />
    </cds-label>
</form>
```

### Translation

Please refer to [this page](widget-translations.md) on how to implement translations from your specification in template or component code.

### Data source module

Finally, having defined a specification and configuration component, we can construct a module. Keep to the below guidelines in constructing your module. When you finally import this module into the `AppModule` of your implementation, the data source configuration component should be available in the relevant configuration menus in your front-end.

#### **`sample-data-source.module.ts`**

```typescript
...
import {DATA_SOURCE_TOKEN} from '@valtimo/dashboard';
import {sampleDataSourceSpecification} from './sample-data-source.specification';
...

@NgModule({
    declarations: [SampleDataSourceConfigurationComponent],
    imports: [CommonModule, WidgetTranslatePipeModule, ...],
    exports: [SampleDataSourceConfigurationComponent],
    providers: [
        /*
        The specification is provided as a value to the DATA_SOURCE_TOKEN imported from `@valtimo/dashboard`.
        This makes it available in your implementation. Make sure to set the `multi` option to `true` like below.
         */
        {provide: DATA_SOURCE_TOKEN, useValue: sampleDataSourceSpecification, multi: true},
    ],
})
export class SampleDataSourceModule {}
```
