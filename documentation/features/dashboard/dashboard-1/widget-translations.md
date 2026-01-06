# Widget translations

## Widget translate pipe

The template code shown uses the `widgetTranslate` pipe to show translations from the specifications. To use this, first import `WidgetTranslatePipeModule` from `@valtimo/dashboard` and add it to the `imports` array of a module. Now, the `widgetTranslate` pipe can be used in templates. It uses the following syntax for data sources:

#### **`sample-translation-pipe.component.html`**

```angular2html
<span>
    {{ 'translationKey' | widgetTranslate: dataSourceKey | async" }}
</span>
```

And for display types:

#### **`sample-translation-pipe.component.html`**

```angular2html
<span>
    {{ 'translationKey' | widgetTranslate: displayTypeKey | async" }}
</span>
```

The pipe returns an observable, so do not forget to add `| async` at the end.

`translationKey` refers to one of the translation keys specified in a data source or display type specification.

`displayTypeKey` and `dataSourceKey` are provided as inputs on configuration components by default.

#### Widget translation service

If translation is to take place inside the component (as opposed to inside the template using the pipe), the `WidgetTranslationService` may be used, which is exported by `@valtimo/dashboard`. It supports a `translate` method, which returns an observable containing the translation, and an `instant` method, which returns a string containing the translation.
