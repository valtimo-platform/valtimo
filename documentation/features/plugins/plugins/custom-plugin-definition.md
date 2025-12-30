# Custom plugin definitions

Valtimo offers the functionality needed to create and add plugins to Valtimo implementations.

{% hint style="info" %}
### Prerequisites <a href="#prerequisites" id="prerequisites"></a>

Plugins are added to a Valtimo implementation. See [this page](../../../fundamentals/getting-started/#starting-your-own-valtimo-implementation) to get started with your own Valtimo implementation.
{% endhint %}

### Back-end <a href="#back-end" id="back-end"></a>

#### Creating a plugin definition <a href="#creating-a-plugin-definition" id="creating-a-plugin-definition"></a>

**Dependencies**

To create a custom plugin in your project, the following dependency is needed:

* valtimo:plugin

for example:

```kotlin
    implementation("com.ritense.valtimo:plugin:$valtimoVersion") 
```

**Creating a plugin class**

A plugin can be created with the `@Plugin` annotation on the class. All classes with the plugin annotation are detected when the application is started. The plugin class should not be a Spring bean.

For example:

```kotlin
@Plugin(
  key = "sample",
  title = "Sample Plugin",
  description = "Sample plugin description",
)
class SamplePlugin(
...
}
```

**Plugin properties**

A plugin can be configured with properties. Properties can be added to the plugin class with the `@PluginProperty` annotation.

For example:

```kotlin
@PluginProperty(key = "username", secret = false)
private lateinit var username: String
```

By setting the `secret` attribute in this annotation to `true` the plugin property will be marked as a secret. This is meant to be used for sensitive information (e.g. passwords or API keys). Secrets are encrypted before being stored in the database and will be automatically decrypted before use in the plugin.

These things should be kept in mind when creating the frontend components for secrets:

* When editing an existing plugin configuration, the value will not be sent back to the frontend to avoid exposing sensitive data.
* Only when submitting a value that is not null or an empty string will the property be updated.
* This functionality requires an application property `valtimo.plugin.encryption-secret`. The value of this property determines the encryption key. The encryption secret has to be EXACTLY 16, 24 or 32 bytes.

**Plugin action**

A plugin class can have methods that are marked as actions through the `@PluginAction` annotation. These methods can then be used in a process definition through the use of [process links](../../process/process-link.md#creating-a-plugin-process-link). A single action can be linked to a task, and will run when that task is reached.

For example:

```kotlin
@PluginAction(
  key = "sample-action",
  title = "Sample action",
  description = "Sample plugin action",
  activityTypes = [ActivityTypeWithEventName.SERVICE_TASK_START],
)
fun samplePrint(
) {
  println("HELLO WORLD")
}
```

#### The complete example <a href="#the-complete-example" id="the-complete-example"></a>

In order to have an example with constructor parameters, let's also assume there is a SampleClient that is used by the plugin. The SampleClient is a regular Spring Bean. Based on the previous steps, the complete example now looks like this:

```kotlin
@Plugin(
    key = "sample",
    title = "Sample Plugin",
    description = "Sample plugin description",
)
class SamplePlugin(
    val sampleClient: SampleClient,
) {

    @PluginProperty(key = "url", secret = false)
    lateinit var url: String

    @PluginAction(
        key = "sample-action",
        title = "Sample action",
        description = "Sample plugin action",
        activityTypes = [ActivityTypeWithEventName.SERVICE_TASK_START],
    )
    fun samplePrinter(
        @PluginActionProperty message: String,
    ) { 
        println("User: $username - Response: ${sampleClient.getSomething(username, message)}" )
    }
}
```

#### Creating a plugin factory <a href="#creating-a-plugin-factory" id="creating-a-plugin-factory"></a>

The newly created plugin class can not be used yet because Valtimo does not know how to create the new plugin. This problem is solved by creating a factory that extends the `PluginFactory` and registering it as a bean. The `create()` method has to be implemented to inject Spring beans or other objects that are necessary. This does not include plugin properties, as those are set automatically.

For example:

```kotlin
@Component
class SamplePluginFactory(
  pluginService: PluginService,
  val sampleClient: SampleClient,
) : PluginFactory<SamplePlugin>(pluginService) {
  override fun create(): SamplePlugin {
    return SamplePlugin(sampleClient)
  }
}
```

#### Optional additional steps <a href="#optional-additional-steps" id="optional-additional-steps"></a>

The backend part of the Sample plugin is now ready. Some topics have not yet been mentioned. These are optional and can be found at the bottom of this page.\
@PluginEvent\
@PluginCategory

### Frontend <a href="#frontend" id="frontend"></a>

To develop a frontend plugin, the library `@valtimo/plugin` provides several interfaces which a frontend plugin must conform to, in order to be used in an implementation.

#### Plugin specification <a href="#plugin-specification" id="plugin-specification"></a>

First, a plugin specification conforming to the PluginSpecification interface needs to be created. Below is an example specification with explanations for each property:

**`sample.plugin.specification.ts`**

```typescript
import {PluginSpecification} from '@valtimo/plugin';
import {SamplePluginConfigurationComponent} from './components/sample-plugin-configuration/sample-plugin-configuration.component';
import {SAMPLE_PLUGIN_LOGO_BASE64} from './assets';
import {SampleActionConfigurationComponent} from './components/sample-action-configuration/sample-action-configuration.component';

const samplePluginSpecification: PluginSpecification = {
  /*
  The plugin definition key of the plugin.
  This needs to be the same as the id received from the backend
  See the key property of the @Plugin annotation in the backend 
   */
  pluginId: 'sample',
  /*
  A component of the interface PluginConfigurationComponent, used to configure the plugin itself.
   */
  pluginConfigurationComponent: SamplePluginConfigurationComponent,
  // Points to a Base64 encoded string, which contains the logo of the plugin.
  pluginLogoBase64: SAMPLE_PLUGIN_LOGO_BASE64,
  functionConfigurationComponents: {
    /*
     For each plugin action id received from the backend, a component is provided of the interface FunctionConfigurationComponent. 
     These are used to configure each plugin action.
     */
    'sample-action': SampleActionConfigurationComponent,
  },
  /*
  For each language key an implementation supports, translation keys with a translation are provided below.
  These can then be used in configuration components using the pluginTranslate pipe or the PluginTranslationService.
  At a minumum, the keys 'title' and 'description' need to be defined.
  Each function key also requires a translation key. In this case, the key 'sample-action' is added.
   */
  pluginTranslations: {
    nl: {
      title: 'Sample',
      description: 'Sample',
      url: 'URL',
      username: 'gebruikersnaam',
      password: 'wachtwoord'
    },
    en: {
      title: 'Sample',
      description: 'Sample"',
      url: 'URL',
      username: 'username',
      password: 'password'
    }
  }
};

export {samplePluginSpecification};
```

#### Plugin logo <a href="#plugin-logo" id="plugin-logo"></a>

Plugin logos are provided as a Base64 encoded string. This string is then imported in the plugin specification as shown above. The size has to be kept down to a minimum, so logo images must be resized before encoding them to Base64. A maximum height of 60 pixels is advised.

[This website](https://www.base64-image.de/) is good for encoding images to Base64. After uploading, click `show code`, and then copy the string under `For use in <img> elements:`.

Here is a sample file of a Base64 encoded logo:

**`sample-plugin-logo.ts`**

```typescript
const SAMPLE_PLUGIN_LOGO_BASE64 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABBJJREFUeNrswTEBAAAAwqD1T20Hb6AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOA3AQYAAvAAAXL/+O0AAAAASUVORK5CYII=';

export {SAMPLE_PLUGIN_LOGO_BASE64};
```

#### Typing the plugin configuration data <a href="#typing-the-plugin-configuration-data" id="typing-the-plugin-configuration-data"></a>

The plugin configuration component listens to prefill data of the interface `PluginConfigurationData`, and outputs configuration data of this same interface. It is advised to extend this interface and further specify what data the plugin requires. For the sample plugin, this would be:

**`sample-plugin-config.ts`**

```typescript
import {PluginConfigurationData} from '@valtimo/plugin';

interface SamplePluginConfig extends PluginConfigurationData {
    url: string;
}

export {SamplePluginConfig};
```

#### Implementing the plugin configuration component <a href="#implementing-the-plugin-configuration-component" id="implementing-the-plugin-configuration-component"></a>

How a configuration component for the sample plugin can be implemented is shown below. The way this is implemented can differ, as long as the interfaces are conformed to. Below is sample code of implementing the component using components from the library `@valtimo/user-interface`.

**`sample-plugin-configuration.component.ts`**

```typescript
import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {PluginConfigurationComponent} from '@valtimo/plugin';
import {BehaviorSubject, combineLatest, Observable, Subscription, take, tap} from 'rxjs';
import {SamplePluginConfig} from '../models';

@Component({
    selector: 'valtimo-sample-plugin-configuration',
    templateUrl: './sample-plugin-configuration.component.html',
    styleUrls: ['./sample-plugin-configuration.component.scss'],
})
export class SamplePluginConfigurationComponent
    // The component explicitly implements the PluginConfigurationComponent interface
    implements PluginConfigurationComponent, OnInit, OnDestroy
{
    @Input() save$: Observable<void>;
    @Input() disabled$: Observable<boolean>;
    @Input() pluginId: string;
    // If the plugin had already been saved, a prefill configuration of the type SamplePluginConfig is expected
    @Input() prefillConfiguration$: Observable<SamplePluginConfig>;

    // If the configuration data changes, output whether the data is valid or not
    @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
    // If the configuration is valid, output a configuration of the type SamplePluginConfig
    @Output() configuration: EventEmitter<SamplePluginConfig> =
        new EventEmitter<SamplePluginConfig>();

    private saveSubscription!: Subscription;

    private readonly formValue$ = new BehaviorSubject<SamplePluginConfig | null>(null);
    private readonly valid$ = new BehaviorSubject<boolean>(false);

    ngOnInit(): void {
        this.openSaveSubscription();
    }

    ngOnDestroy() {
        this.saveSubscription?.unsubscribe();
    }

    formValueChange(formValue: SamplePluginConfig): void {
        this.formValue$.next(formValue);
        this.handleValid(formValue);
    }

    private handleValid(formValue: SamplePluginConfig): void {
        // The configuration is valid when a configuration title and url are defined
        const valid = !!(formValue.configurationTitle && formValue.url);

        this.valid$.next(valid);
        this.valid.emit(valid);
    }

    private openSaveSubscription(): void {
        /* 
        If the save observable is triggered, check if the configuration is valid, and if so,
        output the configuration using the configuration EventEmitter.
         */
        this.saveSubscription = this.save$?.subscribe(save => {
            combineLatest([this.formValue$, this.valid$])
                .pipe(take(1))
                .subscribe(([formValue, valid]) => {
                    if (valid) {
                        this.configuration.emit(formValue);
                    }
                });
        });
    }
}
```

The corresponding template file looks like this:

**`sample-plugin-configuration.component.html`**

```angular2html
<v-form
    (valueChange)="formValueChange($event)"
    *ngIf="{
        disabled: disabled$ | async,
        prefill: prefillConfiguration$ ? (prefillConfiguration$ | async) : null
    } as obs"
>
    <v-input
        name="configurationTitle"
        [title]="'configurationTitle' | pluginTranslate: pluginId | async"
        [margin]="true"
        [defaultValue]="obs.prefill?.configurationTitle"
        [disabled]="obs.disabled"
        [required]="true"
    >
    </v-input>
    <v-input
        name="url"
        [title]="'url' | pluginTranslate: pluginId | async"
        [margin]="true"
        [defaultValue]="obs.prefill?.url"
        [disabled]="obs.disabled"
        [required]="true"
    >
    </v-input>
</v-form>
```

#### Function configuration components <a href="#function-configuration-components" id="function-configuration-components"></a>

Each plugin action received from the backend must have a corresponding function configuration component in the frontend. Implementing these components works in much the same way as implementing the plugin configuration component, The only difference is that function configuration components do not have to provide a configuration title. Below is sample code for the sample plugin action with the id `sample-action`:

**`sample-action-config.ts`**

```typescript
interface SampleActionConfig {
    message: string;
}

export {SampleActionConfig};
```

**`sample-action-configuration.component.ts`**

```typescript
import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {FunctionConfigurationComponent} from '@valtimo/plugin';
import {BehaviorSubject, combineLatest, Observable, Subscription, take, tap} from 'rxjs';
import {SampleActionConfig} from '../models';

@Component({
    selector: 'valtimo-sample-action-configuration',
    templateUrl: './sample-action-configuration.component.html',
    styleUrls: ['./sample-action-configuration.component.scss'],
})
export class SampleActionConfigurationComponent
    // The component explicitly implements the FunctionConfigurationComponent interface
    implements FunctionConfigurationComponent, OnInit, OnDestroy
{
    @Input() save$: Observable<void>;
    @Input() disabled$: Observable<boolean>;
    @Input() pluginId: string;
    @Input() prefillConfiguration$: Observable<SampleActionConfig>;
    @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
    @Output() configuration: EventEmitter<SampleActionConfig> =
        new EventEmitter<SampleActionConfig>();

    private saveSubscription!: Subscription;

    private readonly formValue$ = new BehaviorSubject<SampleActionConfig | null>(null);
    private readonly valid$ = new BehaviorSubject<boolean>(false);

    ngOnInit(): void {
        this.openSaveSubscription();
    }

    ngOnDestroy() {
        this.saveSubscription?.unsubscribe();
    }

    formValueChange(formValue: SampleActionConfig): void {
        this.formValue$.next(formValue);
        this.handleValid(formValue);
    }

    private handleValid(formValue: SampleActionConfig): void {
        const valid = !!(formValue.message);

        this.valid$.next(valid);
        this.valid.emit(valid);
    }

    private openSaveSubscription(): void {
        this.saveSubscription = this.save$?.subscribe(save => {
            combineLatest([this.formValue$, this.valid$])
                .pipe(take(1))
                .subscribe(([formValue, valid]) => {
                    if (valid) {
                        this.configuration.emit(formValue);
                    }
                });
        });
    }
}
```

**`sample-action-configuration.component.html`**

```angular2html
<v-form
    (valueChange)="formValueChange($event)"
    *ngIf="{
        disabled: disabled$ | async,
        prefill: prefillConfiguration$ ? (prefillConfiguration$ | async) : null
    } as obs"
>
    <v-input
        name="message"
        [title]="'message' | pluginTranslate: pluginId | async"
        [margin]="true"
        [defaultValue]="obs.prefill?.message"
        [disabled]="obs.disabled"
        [required]="true"
    >
    </v-input>
</v-form>
```

#### Adding the plugin module to the @NgModule <a href="#adding-the-plugin-module-to-the-ngmodule" id="adding-the-plugin-module-to-the-ngmodule"></a>

The main app.module.ts needs to be updated as well. The @NgModule needs to have added imports:

**`app.module.ts`**

```typescript
@NgModule({
  declarations: [
          ...
  ],
  imports: [
          ...
    SamplePluginModule
  ],
  providers: [...,
    {
      provide: PLUGINS_TOKEN,
      useValue: [
        samplePluginSpecification
      ],
    },
  ],
  bootstrap: [AppComponent]
})
```

#### Plugin translations <a href="#plugin-translations" id="plugin-translations"></a>

**Plugin translate pipe**

The template code shown above uses the `pluginTranslate` pipe to show translations from the plugin specification. To use this, first import `PluginTranslatePipeModule` from `@valtimo/plugin` and add it to the `imports` array of the plugin module. Now, the `pluginTranslate` pipe can be used in templates. It uses the following syntax:

**`sample-translation-pipe.component.html`**

```angular2html
<span>
    {{ 'translationKey' | pluginTranslate: pluginId | async" }}
</span>
```

The pipe returns an observable, so do not forget to add `| async` at the end.

`translationKey` refers to one of the translation keys specified in the plugin specification.

`pluginId` refers to the plugin's definition key. For the sample plugin, this would be `sampleplugin`. It is provided by the `pluginId` input on the configuration component by default.

**Plugin translation service**

If translation is to take place inside the component (as opposed to inside the template using the pipe), the `PluginTranslationService` may be used, which is exported by `@valtimo/plugin`. It supports a `translate` method, which returns an observable containing the translation, and an `instant` method, which returns a string containing the translation.

#### Plugin module <a href="#plugin-module" id="plugin-module"></a>

Finally, after implementing the components and specification, a module has to be defined for the plugin. This module, together with the specification, is then imported in the app module.

The sample plugin module would look like this:

**`sample-plugin.module.ts`**

```typescript
import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {PluginTranslatePipeModule} from '@valtimo/plugin';
import {FormModule, InputModule} from '@valtimo/components';
import {SamplePluginConfigurationComponent} from './components/sample-plugin-configuration/sample-plugin-configuration.component';
import {SampleActionConfigurationComponent} from './components/sample-action-configuration/sample-action-configuration.component';

@NgModule({
    declarations: [SamplePluginConfigurationComponent, SampleActionConfigurationComponent],
    imports: [CommonModule, PluginTranslatePipeModule, FormModule, InputModule],
    exports: [SamplePluginConfigurationComponent, SampleActionConfigurationComponent],
})
export class SamplePluginModule {}
```

### Optional backend annotations <a href="#optional-backend-annotations" id="optional-backend-annotations"></a>

For the plugin backend example above, not all annotations have been used. In this section you find information for the annotations @PluginEvent and @PluginCategory.

#### Plugin events <a href="#plugin-events" id="plugin-events"></a>

A plugin class can have methods that need to be run on plugin creation, update or deletion. This can be achieved with the `@PluginEvent` annotation. These methods will then be invoked during the corresponding event of a Plugin Configuration lifecycle.

For example, `startListener()` will be executed when a Plugin Configuration is being created:

```kotlin
@PluginEvent(invokedOn = [EventType.CREATE])
fun startListener() {
    ...
```

Available event types: `CREATE`, `UPDATE` and `DELETE`. It is possible to run a method on all three of these events by specifying so in the `invokedOn` argument of the annotation e.g. `@PluginEvent(invokedOn = [EventType.CREATE, EventType.DELETE])`. A `PluginEventInvocationException` with references to the plugin and any underlying exceptions will be thrown should a method ran as part of an event fail.

**NB! Limitations**

* If the annotation contains duplicate event types, then the method will still only be invoked once per event type per annotation.

```kotlin
@PluginEvent(invokedOn = [EventType.CREATE, EventType.DELETE, EventType.CREATE])
fun willRunOnceOnCreateAndDelete() {
    ...
```

* Only methods without arguments are supported.
* Annotated methods are resolved in alphabetical order.

#### Plugin categories <a href="#plugin-categories" id="plugin-categories"></a>

Plugin categories denote a commonality between plugins. They can be applied to interfaces, so any plugin implementing this will belong to that category. When a plugin implements more than one interface with a category, it belongs to multiple categories. This can be used by the backend to create plugins that rely on other plugins to be configured, and can be used by the frontend to search for plugins in a specific category.

A plugin implementing an interface annotated with `@PluginCategory` can be autowired into a `@PluginProperty` of the same type on a different plugin.

The example below explains the implementation of a sample supplier for the Sample plugin.

First, the interface is defined that includes the required functionality. `@PluginCategory` with a key is added so that can be used to find configurations of that type in the frontend:

```kotlin
@PluginCategory(key = "sample-supplier")
interface SampleSupplier {
    fun supplyMessage() : String
}
```

At least one implementation of the plugin is required. In this case, the `PropertySampleSupplier` implements the interface `SampleSupplier` and supports all required functionality. When searching for configurations for category `sample-supplier`, all stored `PropertySampleSupplier` configurations are found.

```kotlin
@Plugin(
  key = "example-sample-supplier",
  title = "Poperty sample supplier",
  description = "Property description"
)
class PropertySampleSupplier: SampleSupplier {
    @PluginProperty(key = "message", secret = false)
    private lateinit var message: String
    
    fun supplyMessage(): String {
       return message
    }
}
```

When creating a configuration of the `SamplePlugin`, the frontend should get and show a list of all available configuration of type `sample-supplier`. The ID of the chosen configuration will be part of the properties submitted for the creation of the `SamplePlugin` configuration. The `@PluginProperty` can reference the interface type corresponding to the category. The plugin will then be automatically injected with the corresponding configuration when using the `SamplePlugin`.

```kotlin
@Plugin(
    key = "sample",
    title = "Sample Plugin",
    description = "Sample plugin description"
)
class SamplePlugin {
  @PluginProperty(key = "sampleSupplierConfigurationId", secret = false)
  private lateinit var sampleSupplier: SampleSupplier

  @PluginAction(
    key = "post-sample",
    title = "Post sample",
    description = "Post a sample",
    activityTypes = [ActivityTypeWithEventName.SERVICE_TASK_START]
  )
  fun postSample(execution: DelegateExecution, postSampleProperties: PostSampleProperties) {
      val message = sampleSupplier.supplySample()
        ...
  }
}
```
