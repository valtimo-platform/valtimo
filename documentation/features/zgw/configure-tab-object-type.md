# Creating extra case tabs for Zaakobjects

On the details page of a case instance, several tabs are shown. It is possible to display a tab per object type, so the user can see all relevant data in a separate tab.

These tabs can be customized via front-end implementation code.

## Configuring the tabs in the environment file

To customize which tabs are shown, open `environment.ts` in the implementation's `src/environment` folder. Here, the `caseObjectTypes` object is defined. It can provide a list of definition names, that contain one or more objects names of types of type `string`, that will be converted into new tabs to be displayed.

Configuration is optional (see example below).

#### **`environment.ts`**

```typescript
export const environment: ValtimoConfig = { ...
  caseObjectTypes: {
    'leningen': ['Boom', 'Straatverlichting'],
    'generieke-zaak': ['Boom', 'Monument'], 
  },
 }
```

Per configured Zaakobjecttype, a separate new tab will show at the case detail page, with a list of objects of the configured object type. This list will be populated with the following data: `index`, `registration at`, `title` and a **'view object'** `button` to display the task details.

By clicking on the button, a modal will be opened on the right side of the page showing a read only form containing the object data. [The form that is used needs to be configured](../forms/configure-object-form.md). If the form is not configured, a message will be displayed stating that the data was not found.
