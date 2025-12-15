---
icon: laptop-code
---

# For developers

{% hint style="info" %}
The for developers section within each feature gives more tech heavy information of configuring, extending or altering Valtimo via the codebase.
{% endhint %}

## Custom translation resources

Custom JSON translation files can be added to an implementation by adding a reference to the directory in which they are located to the environment file. In the referenced directory, the translation files must have the language for which they contain translations in their file names; i.e. `src/assets/i18n/nl.json`, `src/assets/i18n/de.json` and `src/assets/i18n/en.json`.

The corresponding environment file would then contain the following `translationResources` key:

#### **`src/environments/environment.ts`**

```typescript
...

export const environment: ValtimoConfig = {
    ...
    translationResources: [
        './assets/i18n/'
    ],
    ...
};
```

### Multi translation loader

The Valtimo front-end uses `@ngx-translate/core'` for its translations. In addition, a custom `TranslateLoader` must be provided to it, in order to support translation files from multiple locations. This can be accomplished by providing this custom loader in the app module:

#### **`src/app/app.module.ts`**

```typescript
...
import {HttpBackend, ...} from '@angular/common/http';
import {TranslateLoader, TranslateModule} from '@ngx-translate/core';
import {..., ConfigService, MultiTranslateHttpLoaderFactory} from '@valtimo/config';
...

@NgModule({
    ...
    imports: [
        ...
        TranslateModule.forRoot({
            loader: {
                provide: TranslateLoader,
                useFactory: MultiTranslateHttpLoaderFactory,
                deps: [HttpBackend, ConfigService],
            },
        }),
        ....
    ],
    ...
})
export class AppModule {
    ...
}

```
