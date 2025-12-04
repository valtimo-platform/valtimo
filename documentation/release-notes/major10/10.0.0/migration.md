# Migration

This page describes how to update Valtimo from the previous version to the current.

*   **MySQL 5.7 end of life**

    Scope: Backend

    Now that the extended support for MySQL 5.7 is ending, it is recommended to upgrade any MySQL database to MySQL 8 or higher. More information [here](../../../nog-een-plek-geven/reference/supported-databases.md).
*   **Java 17**

    Scope: Backend

    In order to run Valtimo a Java 17 environment must be used. The way to configure this is different per implementation. For example, the Java version used when gradle with gradle can be set like this:

    ```groovy
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
    ```

    Also make sure that when building to a docker container a base image is used that supports Java 17.
*   **View configurator**

    Scope: Backend

    The view configurator module has been removed. This module has not been supported by the front-end since Valtimo 5 and any implementation that has this on the classpath can remove this module. Any implementation that has had this module on the classpath can run this database script for [MySQL](https://github.com/valtimo-platform/valtimo-migration/blob/main/10.0.0/mysql/valtimo-migration-view-configurator-10.0.0-mysql.sql) or [PostgreSQL](https://github.com/valtimo-platform/valtimo-migration/blob/main/10.0.0/postgresql/valtimo-migration-view-configurator-10.0.0-postgres.sql) to clean up the database.
*   **Process data object relation**

    Scope: Backend

    Process data object relations have been removed. Any implementation that has entities that extend the `IProcessDataObject` class are to remove this interface and store the data in their document definition instead. This data can be the entity or a reference to the entity, and has to be migrated before upgrading to this version of Valtimo.

    Additionally, the following database script should be used for [MySQL](https://github.com/valtimo-platform/valtimo-migration/blob/main/10.0.0/mysql/valtimo-migration-process-data-object-10.0.0-mysql.sql) or [PostgreSQL](https://github.com/valtimo-platform/valtimo-migration/blob/main/10.0.0/mysql/valtimo-migration-process-data-object-10.0.0-postgres.sql) to clean up the database.
*   **Angular upgrade**

    Scope: Frontend

    In order to use the new front-end libraries based on Angular version 14 in an implementation, run the following command in the root of the implementation project: `ng update @angular/core@14 @angular/cli@14`
*   **Dependency upgrades**

    Scope: Frontend

    In order to use the front-end libraries with upgraded dependencies, make sure to first upgrade your implementation to Angular 14 by following the steps mentioned on this page.
*   **Redundant stylesheets**

    Next, you might have to delete the following lines from the `styles` array in `angular.json` in the root of your implementation:

    `"node_modules/dmn-js/dist/assets/dmn-font/css/animation.css"`

    `"node_modules/dmn-js/dist/assets/dmn-font/css/dmn-ie7.css"`

    `"node_modules/dmn-js/dist/assets/dmn-font/css/dmn-ie7-codes.css"`
*   **New required dependency**

    Scope: Front-end

    `ngx-translate-multi-http-loader` requires a new dependency. Run the following command in the root of the implementation project: `npm i deepmerge-ts`.
*   **Matching dependencies**

    Then, make sure the following dependencies in `package.json` in the root of your implementation have the following versions:

    **`package.json`**

    ```json
    {
      "dependencies": {
        ...
        "@mdi/font": "^7.0.96",
        ...
        "dmn-js": "^12.1.0",
        "dropzone": "^6.0.0-beta.2",
        "ngx-color-picker": "^13.0.0",
        ...
        "ngx-translate-multi-http-loader": "^9.0.0",
        ...
        "swagger-ui": "^4.15.0",
        ...
        "zone.js": "^0.11.8"
      },
      "devDependencies": {
        ...
        "@types/jasmine": "^4.3.0",
        "@types/jasminewd2": "^2.0.10",
        ...
        "jasmine-core": "^4.4.0",
      } 
    }
    ```

    Note: if your implementation has any dependencies not included in the above example, and installing dependencies or building your application causes errors, make sure the versions of these dependencies match the versions in this release of `valtimo-frontend-libraries`.

    _Translate loader upgrade_

    `ngx-translate-multi-http-loader` has been upgraded from version 7 to version 9. This upgrade requires adjustments in implementations of Valtimo: `HttpClient` needs to be replaced by `HttpBackend` in the `deps` of the `loader` of `TranslateModule`.

    **`app.module.ts.ts`**

    ```typescript
    import {HttpBackend, HttpClientModule} from '@angular/common/http';
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
      ],
      ...
    })
    ...
    ```

    If your implementation uses custom translation resources, these need to be adjusted in the environment file of your implementation. The environment property `translationResources` no longer accepts an array of `ITranslationResource`, but an array of strings. The properties `prefix` and `suffix` are now redundant. For example, if the previous value in your environment file was `[{prefix: 'src/assets/translation', suffix: 'json'}]`, it should now be `['src/assets/translation']`.

    _Migrating from `Protractor` to `Cypress`_

    Support for `Protractor` (an end-to-end testing framework) in the Angular CLI will be discontinued. Either remove `Protractor` from your implementation, or migrate to Cypress [by following this guide](https://blog.ninja-squad.com/2021/05/05/migrating-from-protractor-to-cypress/). The latter is recommended.
*   **REST API versioning**

    Scope: Front-end and back-end

    Versioning has been introduced for every REST endpoint exposed by Valtimo. If your implementation manually makes calls to currently existing Valtimo endpoints, these will have to be changed, e.g. `/api/document` becomes `/api/v1/document`.
*   **Auth0 removed as authentication provider**

    Scope: Front-end

    As of major version 10, Auth0 is no longer supported as an authentication provider. In order to adjust your implementation remove the dependencies `@auth0/angular-jwt` and `@valtimo/auth0`. Also, remove the files `auth0-config.dev.ts`, `auth0-config.prod.ts` and `auth0-config.test.ts` from `src/environments/auth` if they exist. Lastly, make sure none of the environment files in your implementation use Auth0 under the key `authentication`.
*   **Removed deprecated code**

    Scope: Back-end

    The following table shows the methods that were removed, and which methods should be used instead:

| Class                                  | Removed method                                                                                                         | Replacement method                                                                                | Notes                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `ValtimoUser`                          | `ValtimoUser(String, String, String, String, String, String, String, boolean, String, boolean, boolean, List<String>)` | -                                                                                                 | Use `ValtimoUserBuilder` instead                                      |
| `QueryDialectHelper`                   | `getJsonValueExpression(CriteriaBuilder, Path, String)`                                                                | `getJsonValueExpression(CriteriaBuilder, Path, String, Class)`                                    | Classes that implement this method have also had this method removed. |
| `FormFieldDataResolver`                | `supports(ExternalFormFieldType)`                                                                                      | `supports(String)`                                                                                | Classes that implement this method have also had this method removed. |
| `AuthorityCreatedEvent`                | `AuthorityCreatedEvent(UUID, String, LocalDateTime, String, String, Boolean, Money)`                                   | `AuthorityCreatedEvent(UUID, String, LocalDateTime, String, String, Boolean)`                     | Hourly rates were removed.                                            |
| `AuthorityDeletedEvent`                | `AuthorityDeletedEvent(UUID, String, LocalDateTime, String, String, Boolean, Money)`                                   | `AuthorityDeletedEvent(UUID, String, LocalDateTime, String, String, Boolean)`                     | Hourly rates were removed.                                            |
| `AuthorityEvent`                       | `AuthorityEvent(UUID, String, LocalDateTime, String, String, Boolean, Money)`                                          | `AuthorityEvent(UUID, String, LocalDateTime, String, String, Boolean)`                            | Hourly rates were removed.                                            |
| `AuthorityNameChangedEvent`            | `AuthorityNameChangedEvent(UUID, String, LocalDateTime, String, String, Boolean, Money, String)`                       | `AuthorityNameChangedEvent(UUID, String, LocalDateTime, String, String, Boolean, String)`         | Hourly rates were removed.                                            |
| `Authority`                            | `Authority(String, BigDecimal, boolean)`                                                                               | `Authority(String, boolean)`                                                                      | Hourly rates were removed.                                            |
| `AuthorityRequest`                     | `AuthorityRequest(String, BigDecimal)`                                                                                 | `AuthorityRequest(String)`                                                                        | Hourly rates were removed.                                            |
| `FormFileResource`                     | `uploadFile(String, MultipartFile)`                                                                                    | `uploadFile(String, String, MultipartFile)`                                                       | -                                                                     |
| `FormAssociationService`               | `getPreFilledFormDefinitionByFormLinkId(Document.Id, String, String, String)`                                          | `getPreFilledFormDefinitionByFormLinkId(String, String, Optional<Document.Id>, Optional<String>)` | -                                                                     |
| `BlacklistRepository`                  | `findByEmailAddress(String)`                                                                                           | `existsById(String)`                                                                              | -                                                                     |
| `BlacklistService`                     | `blacklist(EmailAddress, String)`                                                                                      | `blacklist(String, LocalDateTime, String)`                                                        | -                                                                     |
| `DocumentenService`                    | `createObjectInformatieObject(URI, UUID, String)`                                                                      | `createObjectInformatieObject(URI, UUID)`                                                         | -                                                                     |
| `DocumentDefinitionProcessLinkService` | `getDocumentDefinitionProcess(String)`                                                                                 | `getDocumentDefinitionProcessList(String)`                                                        | -                                                                     |
| `DocumentDefinitionProcessLinkService` | `getDocumentDefinitionProcessLink(String)`                                                                             | `getDocumentDefinitionProcessLink(String, String)`                                                | -                                                                     |

In addition to this, the following classes were removed. No replacements were added as these should not be used.

| Class                             | Notes                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `AuthorityHourlyRateChangedEvent` | Hourly rates were removed.                                                                                                     |
| `ExternalFormFieldType`           | Enum was removed to increase extendability. See [here](/broken/pages/4BYIQ5ySi4VGfLHvQm38) for a list of external form fields. |

*   **Carbon design system**

    Scope: Front-end

    The user interface of Valtimo will now use the Carbon design system. In order to make this work in your implementation, first make sure the `@valtimo/*` dependencies in `package.json` are version 10 or higher and run `npm install`. Your `node_modules` folder should now include the packages `@carbon/icons`, `carbon-components` and `carbon-components-angular`.

    Next, add the follow entries to the end of the `styles` array in `angular.json` in your project root: `"node_modules/@valtimo/components/assets/css/carbon.scss"` and `"node_modules/@valtimo/components/assets/css/carbon-beagle-compatibility.scss"`.

    The environment files (of type `ValtimoConfig`) now support an entry `applicationTitle`. This can be left empty and defaults to Valtimo. If another value is specified, the page titles, tab titles and breadcrumbs will make use of this new title.

    The logos of implementations are now specified through a Base64 string in the environment file, either under the key `logoSvgBase64` or `logoPngBase64`, which means the logo can either be in the `.png` format or the `.svg` format, encoded in Base64.

    To use your own logo, first make sure to resize it to an optimal resolution if it's a `.png` file (a height of about 30px is recommended). If it is a `.svg` image, you might want to make use of [an optimization tool](https://jakearchibald.github.io/svgomg/) to reduce its file size and complexity.

    Next, create a file in the same folder as your environment files: `logo.ts`. From this file, export a string containing your base64 encoded logo. Use [this page](https://base64.guru/converter/encode/image/svg) to encode `.svg` to a Base64 string. Use [this page](https://base64.guru/converter/encode/image/png) to encode `.png` to Base64. Make sure the option 'Plain text -- just the Base64' value is selected. The resulting Base64 string should not be prefixed with `data:`.

    Finally, import this string value containing a Base64 image in your environment file and specify it under the key `logoSvgBase64` for `.svg` images, or under the key `logoPngBase64` for `.png` images.

    The functionality to highlight the active menu item in the Carbon sidebar depends on the `sequence` numbers of the menu items under `menu.menuItems` in your environment file(s). Make sure the sequence numbers of menu items, and child menu items, are consecutive. No menu items on the same level should have the same sequence numbers
