# Documenten API Preview plugin

The "Documenten API Preview plugin" is used in combination with the "Documenten API plugin" to support previewing 
documents directly within GZAC.

> NOTE:
> 
> The "Documenten API Preview plugin" requires at least one  "Documenten API plugin" to be configured. More details on
> configuring the "Documenten API plugin" can be found in the [Documenten API plugin configuration guide](./configure-documenten-api-plugin.md).

## Configure the plugin

The "Documenten API Preview plugin" can be used to generate a readonly preview version of documents retrieved via the
"Documenten API plugin" and works by converting documents to PDF which are displayed in the browser. The conversion of 
the original documents to PDF format is done using the open-source project [Gotenberg][1], which is 
a Docker-based API specifically designed to convert documents to PDF. This means the "Documenten API Preview plugin" 
requires some configuration. A general description on how to configure plugins can be found in the [plugin configuration guide](../../plugins/configure-plugin.md).

To configure this plugin the following properties have to be entered:

* **Configuration ID (`configurationId`).** The plugin will be saved under this ID. The ID must be in the format of a UUID.
* **Configuration name (`configurationTitle`).** A user-friendly name that is used to identify the plugin (default value is "Documenten API Preview").
* **PDF Conversion URL (`pdfConversionUrl`).** Contains the complete base URL pointing to the server hosting the [Gotenberg][1] API (for example: `https://gotenberg:3000`). 
* **Configuration documenten-api plug-in (`documentenApiConfigurationId`).** Contains a reference to the configuration of the "Documenten API plugin". The preview plugin will retrieve documents based on this configuration.

## Configure the Content Security Policy (CSP)

Internally the Valtimo downloads the PDF file into a `blob` field and uses the HTML `<object>`, `<iframe>` tags to 
display the PDF. Since Valtimo offers a strongly typed CSP configuration (see [Content Security Policy][2]), the CSP 
configuration needs to be updated to allow for `blob` resources to be displayed via the `<object>`, `<iframe>` tags. 

To do so add the lines `'object-src': [SELF, BLOB]` and `'frame-src': [SELF, BLOB]` to the CSP configuration for each of 
the environments you want support the preview plugin (see [Content Security Policy][2] guide for more detailed 
instructions on CSP configuration). An example configuration that supports loading `blob` resources looks like this:

```ts
import {CSPHeaderParams, DATA, SELF, UNSAFE_EVAL, UNSAFE_INLINE, BLOB} from 'csp-header';
import {UrlUtils} from '@valtimo/shared';
import {authenticationKeycloak} from '../auth/keycloak-config';

export const cspHeaderParamsDev: CSPHeaderParams = {
  directives: {
    'default-src': [SELF],
    'frame-src': [SELF, BLOB],
    'object-src': [SELF, BLOB],
    'img-src': [SELF, DATA, 'https://tile.openstreetmap.org/'],
    'script-src': [SELF, UNSAFE_EVAL, UNSAFE_INLINE, 'https://cdn.form.io/'],
    'worker-src': [SELF, BLOB],
    'font-src': [
      SELF,
      DATA,
      UNSAFE_INLINE,
      'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/',
      'https://fonts.gstatic.com',
    ],
    'connect-src': [
      SELF,
      UrlUtils.getUrlHost(authenticationKeycloak.options.keycloakOptions.config.url),
    ],
    'style-src': [
      SELF,
      UNSAFE_INLINE,
      'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/',
      'https://fonts.googleapis.com',
    ],
  },
};
```

[1]: https://gotenberg.dev
[2]: ../../../running-valtimo/application-configuration/content-security-policy.md