# Environment

Many aspects of the Valtimo front-end can be configured through Angular environment files. Please refer to the following non-exhaustive list of configuration options, which refer to keys under the interface `ValtimoConfig`.

*   **`formioOptions`**

    The Form.io renderer uses an options object of the type `FormioOptions`. Valtimo provides some defaults (such as language). To override these options with your own, use this key in your environment file. Find an example below of a possible configuration:

```typescript
formioOptions: {
    languageOverride: {
      'en-US': {
        decimalSeparator: ':',
        delimiter: ':',
      },
    },
  },
```
