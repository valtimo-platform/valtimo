# Migration

This page describes how to update Valtimo from the previous version to the current.

*   **Change in Recipient.Type values**

    Scope: back-end

    To meet coding standards, the Enum values of `com.ritense.valtimo.contract.mail.model.value.Recipient.Type` have been changed to all uppercase. References to these Enum values should be changed in implementations:

    * Change uses of Type.To to Type.TO
    * Change uses of Type.Cc to Type.CC
    * Change uses of Type.Bcc to Type.BCC
*   **Rename application property valtimo.jwt.secret**

    Scope: back-end

    1.  **Find valtimo.jwt.secret**

        Find all occurrences of `valtimo.jwt.secret` and rename them all to `valtimo.oauth.public-key`. This property is usually found in the `application.yml`.
    2.  **Find `VALTIMO_JWT_SECRET`**

        Find all occurrences of `VALTIMO_JWT_SECRET` and rename them to `VALTIMO_OAUTH_PUBLIC_KEY`. This environment variable can potentially be found in many different places such as:

        * `.env.properties` file inside the repository
        * AWS Parameter store
        * Kubernetes `.yaml` file
*   **Rename application property valtimo.jwt.tokenValidityInSeconds**

    Scope: back-end

    1.  **Find valtimo.jwt.tokenValidityInSeconds**

        Find all occurrences of `valtimo.jwt.tokenValidityInSeconds` and rename them all to `valtimo.oauth.tokenValidityInSeconds`. This property is usually found in the `application.yml`.
    2.  **Find `VALTIMO_JWT_TOKEN_VALIDITY_IN_SECONDS`**

        Find all occurrences of `VALTIMO_JWT_TOKEN_VALIDITY_IN_SECONDS` and rename them to `VALTIMO_OAUTH_TOKEN_VALIDITY_IN_SECONDS`. This environment variable can potentially be found in many different places such as:

        * `.env.properties` file inside the repository
        * AWS Parameter store
        * Kubernetes `.yaml` file
*   **Whitelist all services used in Camunda processes**

    Scope: back-end

    1.  **Find all services used in processes and decision tables**

        Open all BPMN and DMN files and list all the services and other java/kotlin classes that are used.
    2.  **Find all services in code**

        All the listed services must then be found inside the java/kotlin code.
    3.  **Whitelist the service**

        Whitelisting a service should be done in one of two different ways:

        1.  Either, add `@ProcessBean` above the class. For example:

            ```kotlin
            @ProcessBean
            @Service
            class MyCustomClass {
                ...
            ```
        2.  Or add `@ProcessBean` above the bean definition. For example:

            ```kotlin
            @ProcessBean
            @Bean
            @ConditionalOnMissingBean(MyCustomService::class)
            fun myCustomService(...): MyCustomService {
                return MyCustomService(...)
            }
            ```
*   **Remove the use of authority and contexts entities**

    Scope: back-end

    1. **Find and delete the use of authority classes as they are no longer supported**
       * AuthorityResource.java
       * AuthorityService.java
       * AuthorityRepository.java
       * AuthorityCreatedEvent.java
       * AuthorityDeletedEvent.java
       * AuthorityEvent.java
       * AuthorityNameChangedEvent.java
       * Authority.java
       * AuthorityRequest.java
       * Money.java
    2. **Find and delete the use of context classes as they are no longer supported**
       * ContextResource.java
       * ContextService.java
       * ContextRepository.java
       * UserContextRepository.java
       * UserContextDTO.java
       * Context.java
       * ContextProcess.java
       * MenuItem.java
       * UserContext.java
*   **Angular and dependency upgrades**

    Scope: front-end

    1. **Upgrading Angular**
       * The Valtimo front-end libraries have been upgraded from Angular 14 to Angular 16 in major 11. In order to use them, your implementation also needs to upgrade to Angular 16.
       * Follow [this guide](https://update.angular.io/?v=14.0-15.0) to upgrade from Angular 14 to Angular 15. You will probably need to use `ng update` commands with the `--force` option at the end.
       * After the migration is complete, commit your changes.
       * Follow [this guide](https://update.angular.io/?v=15.0-16.0) to upgrade from Angular 15 to Angular 16. You will probably need to use `ng update` commands with the `--force` option at the end.
       * After the migration is complete, commit your changes.
       * Verify whether all Angular related dependencies in the `package.json` in the root of your project are at version 16. If some have been skipped, check https://www.npmjs.com/ for their latest version and upgrade them manually.
    2. **Removing dependencies**
       * Some dependencies have been removed from the Valtimo front-end libraries. It is advised to remove them from your implementation as well.
       * `@angular/flex-layout` has been deprecated. Remove it from your implementation. To replace its directives, we advise to write regular CSS classes with flexbox styling.
       * If your implementation does not use any `@angular/material` related dependencies, and they are included in your `package.json` dependencies, we advise to remove them.
    3.  **Locking dependencies**

        * In Valtimo front-end libraries, all dependencies not related to Angular have been locked to specific versions, in order to avoid issues which are frequently encountered with automatic minor or patch dependency upgrades.
        * We advise you to do the same; lock all dependencies except for the ones related to Angular. You can achieve this by removing tilde `~` and caret `^` symbols from your implementation's `package.json`.
        * Next, we advise you to lock your dependencies to the same versions used in the Valtimo front-end libraries. A non-exhaustive list of dependencies and their versions is included below. If you cannot find your dependency in the list below, refer to the major 11 front-end libraries `package.json` [here](https://github.com/valtimo-platform/valtimo-frontend-libraries/blob/ac6d123c95fb761079e9d471f6b5aa6943e2bf1e/package.json).

        **`package.json`**

        ```json
        {
          ...
          "dependencies": {
            ...
            "@mdi/font": "7.2.96",
            "@bpmn-io/dmn-migrate": "0.4.3",
            "@webcomponents/custom-elements": "1.6.0",
            "bpmn-js-properties-panel": "0.46.0",
            "core-js": "3.32.0",
            "dmn-js": "12.3.0",
            "dropzone": "6.0.0-beta.2",
            "flatpickr": "4.6.13",
            "json-server": "0.17.3",
            "ngx-color-picker": "14.0.0",
            "ngx-logger": "5.0.12",
            "ngx-translate-multi-http-loader": "16.0.1",
            "popper.js": "1.16.1",
            "rxjs": "7.8.1",
            "swagger-ui": "5.4.2",
            "tslib": "2.6.2",
            "zone.js": "0.13.1"
          },
          "devDependencies": {
            ...
            "@types/jasmine": "4.3.5",
            "@types/jasminewd2": "2.0.10",
            "@types/node": "20.5.0",
            "codelyzer": "6.0.2",
            "deepmerge-ts": "5.1.0",
            "jasmine-core": "5.1.0",
            "jasmine-spec-reporter": "7.0.0",
            "karma": "6.4.2",
            "karma-chrome-launcher": "3.2.0",
            "karma-coverage-istanbul-reporter": "3.0.3",
            "karma-jasmine":"5.1.0",
            "karma-jasmine-html-reporter":  "2.1.0",
            "ts-node": "10.9.1",
            "typescript": "5.1.6"
          }
        }
        ```
    4. **Adding dependencies**
       * `@valtimo/access-control`, should be added to your implementation as it is a required dependency.
    5. **Changing typescript config**
       * In `tsconfig.json` in the root of your implementation, change `module` to `es2020` and also change `es****` in the `lib` array to `es2020`.
*   **Change in Carbon Design System version**

    Scope: front-end

    1. **Install new Carbon Dependencies**
       * Delete node\_modules.
       * Run 'npm install --legacy-peer-deps'.
    2.  **Update all carbon selectors from 'ibm' to 'cds'**

        **`Tags`:**

        ```
        Deprecated:
        <ibm-placeholder></ibm-placeholder>

        Active:
        <cds-placeholder></cds-placeholder>
        ```

        **`Directives`:**

        ```
        Deprecated:
        <button ibmButton="primary"></button>

        Active:
        <button cdsButton="primary"></button>
        ```

        **`Classes`:**

        ```
        Deprecated:
        <svg class="ibm--btn__icon"></svg>

        Active:
        <svg class="cds--btn__icon"></svg>
        ```
    3.  **Remove all usages of @carbon/icons-angular**

        **`Icon`:**

        ```
        Deprecated:
        <svg class="ibm--btn__icon" ibmIconArrowDown size="16"></svg>

        Active:
        <svg class="cds--btn__icon" cdsIcon="arrow--down" size="16"></svg>
        ```
    4. **Registering @carbon/icons**
    5.  In order to use @carbon/icons, the IconModule needs to be imported.

        **`sample.module.ts`**

        ```typescript
        ...
        // import IconModule
        import {IconModule} from 'carbon-components-angular';
        ...

        @NgModule({
            ...
            imports: [
              ...
              IconModule
              ...
            ]
            ...
        })
        export class SampleModule {
         ...
        }
        ```
    6.  Some icons may not be available by default, so they need to be registered in the component where they are needed. This is accomplished via the Carbon IconService

        **`sample.component.ts`**

        ```typescript
        ...
        // import IconService
        import {IconService} from 'carbon-components-angular';
        ...
        // import Icons
        import {ArrowDown16, ArrowUp16} from '@carbon/icons';
        ...

        @Component({
            ...
        })
        export class SampleComponent implements OnInit{
         ...
         constructor(private readonly iconService: IconService) {}
         ...
         public ngOnInit(): void {
          this.iconService.registerAll([ArrowDown16, ArrowUp16]);
         }
         ...
        }
        ```
    7. All icons available through the Carbon library can be found [here](https://angular.carbondesignsystem.com/?path=/docs/components-icon--docs)
*   **Remove deleted admin menu items**

    Scope: front-end

    1. **Remove @valtimo/context**
       * Remove `@valtimo/context` library from the `package.json`.
       * Remove `ContextModule` module from the `app.module.ts`.
    2. **Remove @valtimo/management**
       * Remove `@valtimo/management` library from the `package.json`.
       * Remove `ManagementContextModule` module from the `app.module.ts`.
       * Remove the `Contexts` link from the `environment.ts`
    3. **Remove @valtimo/user-management**
       * Remove `@valtimo/user-management` library from the `package.json`.
       * Remove `UserManagementModule` module from the `app.module.ts`.
       * Remove the `Users` link from the `environment.ts`
    4. **Remove @valtimo/authority**
       * Remove `@valtimo/authority` library from the `package.json`.
       * Remove `AuthorityModule` module from the `app.module.ts`.
       * Remove the `Entitlements` link from the `environment.ts`
*   **Form-links page**

    Scope: front-end

    1.  **environment.ts**

        Go to the environment.ts file and change this line:

        `{link: ['/form-links'], title: 'Form links'...`

        To this line:

        `{link: ['/process-links'], title: 'Process links'...`
*   **Update connector and plugin keys**

    Scope: back-end/front-end

    In order for keys to be encrypted with GCM (as apposed to ECB, see [here](valtimo-backend-libraries.md#new-features) for more information), all existing plugin configurations need to be updated.

    1. **Save existing connector configurations with their keys**
    2. **Save plugin configurations with their keys**
    3. **See if encryption is used anywhere else in the application**
*   **Removal of @valtimo/user-interface library**

    Scope: front-end

    1.  **Remove @valtimo/user-interface as a dependency**

        The library `@valtimo/user-interface` has been removed. All of its components, directives and services have been been moved to `@valtimo/components`. In order to migrate, remove `@valtimo/user-interface` as a dependency in your implementation.
    2.  **Change stylesheet in `angular.json`**

        The `angular.json` file in the root of your implementation includes the following value:

        `"node_modules/@valtimo/user-interface/assets/design-tokens.css"`

        This should be changed to:

        `"node_modules/@valtimo/components/assets/css/design-tokens.css"`
    3.  **Change imports**

        Most components, services and directives from `@valtimo/user-interface` are now exported from `@valtimo/components`. Search your implementations for any imports and change them accordingly.
    4. **Renamed components**

    The component `v-multi-input` has been renamed to `valtimo-carbon-multi-input`. If it is used anywhere in your implementation, change the selector.

    `ModaleModule` exported from `@valtimo/user-interface` is renamed to `VModalModule`.

    `CardModule` exported from `@valtimo/user-interface` is renamed to `VCardModule`.
*   **Update of CarbonTable for backwards compatibility**

    Scope: front-end

    Updates in the _@Input_ fields:

    * _@Input paginationConfig_ -> _@Input paginatorConfig_
    * _@Input fields_ has been added instead of having the columnConfigs in the tableConfig. ColumnConfig now extends the ListField for backwards compatibility.
    * Remove _fields_ property from any instances of CarbonTableConfig as it is no longer a part of the interface
*   **Enable the JSON PBAC editor**

    Scope: front-end

    **Change in `angular.json`**

    1. Go to the file `angular.json`.
    2. Locate the array with assets: `projects.architect.build.options.assets`.
    3. Add the `monaco-editor`:

    ```json
    {
        "glob": "**/*",
        "input": "node_modules/monaco-editor",
        "output": "assets/monaco-editor"
    }
    ```
*   **Add PBAC dependencies and menu items**

    Scope: front-end

    1. **Add PBAC dependencies**

    Run `npm i @valtimo/access-control@11.0.0 @valtimo/access-control-management@11.0.0` in the root of your implementation.

    2. **AppModule**

    Add the following line to the top of `app.module.ts`:

    `import {AccessControlManagementModule} from '@valtimo/access-control-management';`

    Next, add `AccessControlManagementModule` to the `imports` array of `AppModule`.

    3. **Access control management menu item**

    Add the following to the admin menu items in your environment config:

    `{link: ['/access-control'], title: 'Access Control', sequence: UNIQUE_SEQUENCE_NUMBER}`

    Make sure to update `UNIQUE_SEQUENCE_NUMBER` with a unique sequence number.
*   **Moved Verzoek plugin property `objectManagementId`**

    Scope: back-end

    1.  **Locate any .pluginconfig.json file**

        Go to the `/resource` folder of you project and locate any file ending with `.pluginconfig.json`.
    2.  **Find the `verzoek` plugin configurations**

        Every `.pluginconfig.json` can contain Verzoek plugin configuration. This plugin can be recognized where the property `pluginDefinitionKey` is `verzoek`.
    3.  **Move the `objectManagementId`**

        Every Verzoek plugin configuration has a field called `objectManagementId`. This field should be moved out of the `properties` field and into every `verzoekProperties` field.
*   **Configure access control roles and permissions**

    Scope: back-end

    Roles and permissions need to be configured as described [here](../../../features/access-control/).
