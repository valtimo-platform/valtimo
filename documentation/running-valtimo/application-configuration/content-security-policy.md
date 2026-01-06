# Content Security Policy (CSP)

Content Security Policy (CSP) is a layer of security to combat Cross-Site Scripting (XSS). For more information on CSP, please refer to [this page](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP).

Valtimo offers strongly typed CSP configuration through its environment files. In order to add this to your implementation, install version `11.2.0` or higher of the front-end libraries.

## Defining your policy

It is advised to create a new folder in your implementation: `src/environments/csp`. In this folder, you will create a file defining a CSP policy for each environment your implementation is deployed to.

For a CSP for our development environment, we might define the following:

#### **`src/environments/csp/csp.dev.ts`**

```typescript
// types imported from the 'csp-header' package, which is included in Valtimo FE libs 11.2.0 and up
import {CSPHeaderParams, DATA, SELF, UNSAFE_EVAL, UNSAFE_INLINE} from 'csp-header';
// optional import of utilities to manipulate URL strings
import {UrlUtils} from '@valtimo/config';
// the Keycloak configuration used on the development environment
import {authenticationKeycloak} from '../auth/keycloak-config.dev';

// in this object we define our CSP headers, which must conform to the type CSPHeaderParams (imported from 'csp-header')
export const cspHeaderParamsDev: CSPHeaderParams = {
    directives: {
        'default-src': [SELF],
        // DATA is needed because of use of inline images
        'img-src': [SELF, DATA],
        /*
        UNSAFE_EVAL is needed because of javascript in form.io forms (i.e. on summary page)
        Scripts loaded from https://cdn.form.io/ are allowed, otherwise Form.IO won't work in our app.
         */
        'script-src': [SELF, UNSAFE_EVAL, UNSAFE_INLINE, 'https://cdn.form.io/'],
        /* 
        DATA is needed because of use of inline fonts.
        Some external sources are allowed which are used in the Valtimo front-end libraries.
         */
        'font-src': [
            SELF,
            DATA,
            UNSAFE_INLINE,
            'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/',
            'https://fonts.gstatic.com',
        ],
        'connect-src': [
            SELF,
            // connect-src must contain the root url of the keycloak instance the application uses to login
            UrlUtils.getUrlHost(authenticationKeycloak.options.keycloakOptions.config.url),
        ],
        'style-src': [
            SELF,
            // UNSAFE_INLINE is needed because of use of inline styles
            UNSAFE_INLINE,
            // external styles sources used by the Valtimo FE libs
            'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/',
            'https://fonts.googleapis.com',
        ],
    },
};
```

## Including your policy

After defining your policy in a separate file, import it in the environment file in which you want to use it. Next, add it under the key `csp`. After deploying your application, CSP headers should be added to the document head before app initialization.

#### **`src/environments/environment.ts`**

```typescript
...
import {cspHeaderParamsDev} from './csp';

export const environment: ValtimoConfig = {
    ...
    csp: cspHeaderParamsDev
}
```

## Extending your policy

The optional property `csp` in your environment file must refer to an object of type `CSPHeaderParams`, which is exported by the library `csp-header`. This library has many features which you can optionally use to add further flexibility to your CSP policy. Please refer to its [NPM page](https://www.npmjs.com/package/csp-header) to see what is possible.
