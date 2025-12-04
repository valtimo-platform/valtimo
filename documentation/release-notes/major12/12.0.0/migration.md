# Migration

This page describes how to update Valtimo from the previous version to the current.

*   **Spring boot 3 upgrade**

    Scope: back-end

    Full migration instructions for this change can be found [here](spring-boot3-migration.md).
*   **Valtimo dependencies**

    Scope: back-end

    `valtimo-dependencies` and `valtimo-gzac-depenencies` should no longer be used for `dependencyManagement` or `platform`. This functionality has been replaced by [valtimo-dependency-versions](../../../fundamentals/getting-started/modules/core/valtimo-dependency-versions.md).
*   **Access control files**

    Scope: back-end

    1.  **Step 1: Find filed**

        Locate all files in the backend libraries matching: `/resources/config/<filepath>/<filename>.permission.json`
    2.  **Step 2: Locate permissions** Locate all permissions for `CamundaTask` that use the `assignee` field. For example:

        ```json
        {
            "resourceType": "com.ritense.valtimo.camunda.domain.CamundaTask",
            "action": ...,
            "conditions": [
                {
                    "type": "field",
                    "field": "assignee",
                    "operator": "==",
                    "value": "${currentUserEmail}"
                }
            ]
        }
        ```
    3.  **Step 3: Update permissions** Change `${currentUserEmail}` to `${currentUserId}`.

        If the `value` field contains an actual email, then the email must be changed to a user ID.
*   **Access control database**

    Scope: back-end

    1.  **Step 1: Find access control**

        Go to the 'Admin' menu item and then to 'Access control'. Then for every role, do the steps below.
    2.  **Step 2: Locate permissions** Locate all permissions for `CamundaTask` that use the `assignee` field. For example:

        ```json
        {
            "resourceType": "com.ritense.valtimo.camunda.domain.CamundaTask",
            "action": ...,
            "conditions": [
                {
                    "type": "field",
                    "field": "assignee",
                    "operator": "==",
                    "value": "${currentUserEmail}"
                }
            ]
        }
        ```
    3.  **Step 3: Update permissions** Change `${currentUserEmail}` to `${currentUserId}`

        If the `value` field contains an actual email, then the email must be changed to a user ID.
*   **Plugin action activity types**

    Scope: back-end

    1. **Step 1: Locate plugin actions** Locate all `@PluginAction` annotations in the implementation code.
    2.  **Step 2: Update activity type** Change parameter `activityTypes` to use the new type `com.ritense.processlink.domain.ActivityTypeWithEventName`. For example:

        ```kotlin
        @PluginAction(
            key = "send-email",
            title = "Send email",
            description = "Send an email with <example-product>.",
            activityTypes = [ActivityTypeWithEventName.SERVICE_TASK_START]
        )
        fun sendEmail(execution: DelegateExecution, emailProperties: EmailProperties) {
            ...
        ```
*   **Removed form links module**

    Scope: back-end

    The `form-link` module was removed in favor of using the `process-link` module. The following changes should be made:

    1.  **Migrate existing form links**

        Existing form link configurations should be migrated to process links. You can find a script to simplify this task [here](../../../using-valtimo/process-link/script/migrate-formlinks.sh).
    2.  **Remove form link configuration files (optional)**

        Existing form link configuration files should be removed. This is optional as the files will just get ignored.
    3.  **Remove existing tables (optional)**

        Existing form link configurations should be removed. This is optional as the tables technically do not have to be removed. Below is a changelog that removes the tables.

        ```xml
        <?xml version="1.1" encoding="UTF-8" standalone="no"?>
        <databaseChangeLog xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
                           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                           xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-3.6.xsd">
            <changeSet author="Ritense" id="1">
                <dropAllForeignKeyConstraints baseTableName="process_form_association"/>
                <dropAllForeignKeyConstraints baseTableName="process_form_association_v2"/>
            </changeSet>

            <changeSet author="Ritense" id="2">
                <dropTable tableName="process_form_association"/>
                <dropTable tableName="process_form_association_v2"/>
            </changeSet>
        </databaseChangeLog>
        ```
*   **Removed DocumentVariableDelegate class**

    Scope: back-end

    The `DocumentVariableDelegate` is replaced by the `DocumentDelegateService` class. As such, usages in processes and code should be updated to use `DocumentDelegateService` instead.
*   **Deprecated code**

    Scope: back-end

    `CamundaProcessJsonSchemaDocumentService.getDocument(DelegateExecution execution)` has been deprecated. As such, usages in processes and code should be updated to use `DocumentDelegateService.getDocument(DelegateExecution)` instead.

**Zaaktype link moved**

Scope: back-end

The Zaaktype link code has been moved from the `openzaak` module to the `zaken-api` module. This should only affect implementations that use Zaaktype links in custom code. Below is a list of the most important classes that have been moved. This list might not be exhaustive.

| Old class                                                                    | New class                                                         |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `com.ritense.openzaak.service.ZaakTypeLinkService`                           | `com.ritense.zakenapi.service.ZaakTypeLinkService`                |
| `com.ritense.openzaak.service.impl.ZaakTypeLinkService`                      | `com.ritense.zakenapi.service.DefaultZaakTypeLinkService`         |
| `com.ritense.openzaak.listener.DocumentCreatedListener`                      | `com.ritense.zakenapi.service.ZakenApiEventListener`              |
| `com.ritense.openzaak.domain.request.CreateZaakTypeLinkRequest`              | `com.ritense.zakenapi.web.rest.request.CreateZaakTypeLinkRequest` |
| `com.ritense.openzaak.domain.mapping.impl.ZaakTypeLink`                      | `com.ritense.zakenapi.domain.ZaakTypeLink`                        |
| `com.ritense.openzaak.domain.mapping.impl.ZaakTypeLinkId`                    | `com.ritense.zakenapi.domain.ZaakTypeLinkId`                      |
| `com.ritense.openzaak.web.rest.ZaakTypeLinkResource`                         | `com.ritense.zakenapi.web.rest.ZaakTypeLinkResource`              |
| `com.ritense.openzaak.web.rest.impl.ZaakTypeLinkResource`                    | `com.ritense.zakenapi.web.rest.DefaultZaakTypeLinkResource`       |
| `com.ritense.openzaak.service.result.ZaakTypeLinkResult`                     | No replacement needed                                             |
| `com.ritense.openzaak.service.impl.result.CreateZaakTypeLinkResultFailed`    | No replacement needed                                             |
| `com.ritense.openzaak.service.impl.result.CreateZaaktypeLinkResultSucceeded` | No replacement needed                                             |
| `com.ritense.openzaak.domain.mapping.ServiceTaskHandler`                     | Use plugin process link instead                                   |
| `com.ritense.openzaak.domain.mapping.impl.ServiceTaskHandler`                | Use plugin process link instead                                   |
| `com.ritense.openzaak.domain.mapping.impl.ServiceTaskHandlers`               | Use plugin process link instead                                   |
| `com.ritense.openzaak.domain.mapping.impl.InformatieObjectTypeLink`          | No replacement needed                                             |
| `com.ritense.openzaak.domain.mapping.impl.InformatieObjectTypeLinkId`        | No replacement needed                                             |
| `com.ritense.openzaak.domain.event.EigenschappenSetEvent`                    | No replacement needed                                             |
| `com.ritense.openzaak.domain.event.ResultaatSetEvent`                        | No replacement needed                                             |
| `com.ritense.openzaak.domain.event.StatusSetEvent`                           | No replacement needed                                             |
| `com.ritense.openzaak.domain.event.ZaakCreatedEvent`                         | No replacement needed                                             |

The endpoints to manage the Zaaktype link have also been replaced:

| Old endpoint                                            | New endpoint                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------- |
| POST `/api/v1/openzaak/link`                            | POST `/api/management/v1/zaak-type-link`                            |
| DELETE `/api/v1/openzaak/link/{documentDefinitionName}` | DELETE `/api/management/v1/zaak-type-link/{documentDefinitionName}` |

*   **Value resolvers**

    Scope: back-end

    1. **Step 1: Find classes** Locate all Kotlin classes that extend the `: ValueResolverFactory` interface in the implementation code.
    2. **Step 2: Locate functions** In the classes found, locate all function with name `handleValues(...)`
    3. **Step 3: Replace parameter** Change the type of parameter `values` from: `Map<String, Any>` to also support null values: `Map<String, Any?>`.
* **KvKProvider and BsnProvider** The new implementations of `KvKProvider` and `BsnProvider` (`ZaakKvkProvider` and `ZaakBsnProvider`) no longer depend on the `openzaak` module. Please make sure you have configured at least one Zaken API Plugin to make these providers work.
*   **Angular and dependency upgrades**

    Scope: front-end

    1. **Step 1: Node and NPM upgrade** Valtimo front-end libraries 12 requires Node 18. Run the following commands in your terminal (with [NVM](https://github.com/nvm-sh/nvm) installed): `nvm install 18` and `nvm use 18`.
    2. **Step 2: Angular upgrade** Valtimo front-end libraries 12 uses Angular 17. Commit all pending changes in your project and run the following command from your root directory: `ng update @angular/core@17 @angular/cli@17 --force` and commit all changes after the upgrade.
    3. **Step 3: @valtimo/form-link to @valtimo/process-link** The `form-link` library has been renamed to `process-link`. Change `@valtimo/form-link` to `@valtimo/process-link` in your `package.json` file. Also, replace all imports in your from `@valtimo/form-link` to `@valtimo/process-link`.
    4. **Step 4: Upgrade valtimo dependencies** Change the version number of all `@valtimo/**` dependencies in your root `package.json` to the Valtimo 12 version you would like to use.
    5.  **Step 5: Equalize project dependencies with Valtimo dependencies** In order to start your implementation, all dependency version numbers should be equal to the ones used in the

        libraries project. This can be done manually by navigating to the [libraries package.json](https://raw.githubusercontent.com/valtimo-platform/valtimo-frontend-libraries/development/12.0.0/package.json) and copying over the version numbers. It can also be automatically by running the following command from the terminal when in the root of your implementation (where `package.json` is located). When prompted to install dependencies, answer yes.

        `npx make-dir-cli tmp && npx node-wget https://raw.githubusercontent.com/valtimo-platform/valtimo-frontend-libraries/development/12.0.0/scripts/equalize-deps.cjs -d tmp/equalize-deps.cjs && node tmp/equalize-deps.cjs`
    6. **Step 6: Install dependencies and build project** After completing the previous steps, run `npm i` in the root of your project to install all dependencies, and verify after that your project builds.
*   **ChoiceFieldsModule**

    Scope: front-end

    1.  **Change the import path of ChoiceFieldService**

        The ChoiceFieldsService has now been moved into the _@valtimo/components_ library. Adjust any import paths to use this instead of _@valtimo/choice-field_ or _@valtimo/choicefield_.
    2.  **Change import path of ChoiceField and ChoiceFieldValue**

        These models can now be found in the _@valtimo/components_ library. Adjust any import paths to use this instead of _@valtimo/choice-field_ or _@valtimo/choicefield_.
    3.  **Adjust method names**

        A few methods from the former _@valtimo/choicefield_ library now have their names changes:

        * getChoiceFieldValuesPageByName -> queryValuesPage
        * getChoiceFieldValueById -> getValue
        * getChoiceFieldsPage -> queryPage
        * getChoiceFields -> query
    4. **Remove ChoicefieldModule**

    Remove any instances of ChoicefieldModule as it no longer exists. Services and models contained in that module are now a part of _@valtimo/components_.
*   **`@valtimo/open-zaak` removed**

    Scope: front-end

    1. **Remove dependency**

    The library `@valtimo/open-zaak` has been removed. Remove `@valtimo/open-zaak` from your implementation's `package.json`.

    2. **Remove module import**

    Remove the import of `OpenZaakModule` into your `AppModule`.

    3. **Remove extensions**

    If used, remove `emailExtensionInitializer` and `openZaakExtensionInitializer` from `initializers` in your environment file. The email extension has been permanently removed. The OpenZaak extension's functionality is now included in the new library `@valtimo/zgw` (see below).
*   **Connector link extension removed**

    Scope: front-end

    `connectorLinkExtensionInitializer` (exported from `@valtimo/connector-management`) has been removed and its functionality will be captured in other code. If used, remove it from `initializers` in your environment file.
*   **Extensions deprecated**

    Scope: front-end

    Extensions (defined under `initializers` in environment files) have been deprecated. Extensions included in the libraries have been removed. If you have any custom extensions, refactor them to not use extension initializer functionality, since extensions will be removed in the next major release.
*   **`@valtimo/contact-moment` removed**

    Scope: front-end

    The library `@valtimo/contact-moment` has been removed. Remove it from your implementation's `package.json`. This library included a contact moments case tab: `DossierDetailTabContactMomentsComponent`. This has been moved to `@valtimo/zgw`. The contact moments tab has been removed as a default tab in tab management. If you still want to use it, add `contactmomenten: DossierDetailTabContactMomentsComponent` under `CASE_TAB_TOKEN` in your `AppModule` file and configure it as a custom component tab. For more information, [refer to this page](../../../features/case/for-developers/case-tabs.md). `DossierDetailTabContactMomentsComponent` should be imported from `@valtimo/zgw`.
*   **Zaakobjecten default tab removed**

    Scope: front-end

    The zaakobjecten tab has been removed as a default tab in tab management. The zaakobjecten tab has been moved to `@valtimo/zgw`. If you still want to use it, add `zaakobjecten: DossierDetailTabZaakobjectenComponent` under `CASE_TAB_TOKEN` in your `AppModule` file and configure it as a custom component tab. For more information, [refer to this page](../../../features/case/for-developers/case-tabs.md). `DossierDetailTabZaakobjectenComponent` should be imported from `@valtimo/zgw`.
*   **`@valtimo/customer` removed**

    Scope: front-end

    The library `@valtimo/customer` has been removed, and its functionality has been moved to `@valtimo/zgw`. Remove it from your implementation's `package.json`, and change the import of `CustomerModule` from `@valtimo/customer` to `@valtimo/zgw` in `app.module.ts` if you use this functionality.
*   **OpenZaak uploader provider deprecated**

    Scope: front-end

    The OpenZaak upload provider has been deprecated and will be removed in the next major release. This provider is active if `uploadProvider` in your environment file is set to `UploadProvider.OPEN_ZAAK`.
*   **Form.io Documenten API uploader component moved**

    Scope: front-end

    The Documenten API form.io upload component has been moved from `@valtimo/dossier` to `@valtimo/zgw`. If this upload component is included in your project, import `ZgwModule` into your `AppModule` in `app.module.ts` and change the import of `registerDocumentenApiFormioUploadComponent` from `@valtimo/dossier` to `@valtimo/zgw`.
*   **New library: `@valtimo/zgw`**

    A refactor has been made to move all ZGW functionality previously included in default Valtimo libraries to its own, optional dependency: `@valtimo/zgw`. Please install this dependency into your implementation and import `ZgwModule` (which it exports) into your `AppModule` if you use ZGW functionality. If `ZgwModule` is imported, the following functionality is included:

    * Documenten API documents tab. If `uploadProvider` is set to `UploadProvider.DOCUMENTEN_API` in your environment file, and `ZgwModule` is not imported, a not found message will be displayed on the case documents tab.
    * A new ZGW tab on the case management admin page.
    * The component to display object tabs based on the `caseObjectTypes` configuration in your environment file. If `ZgwModule` is not imported, and this configuration is present, a not found message will be displayed on the tabs.
*   **Removed: `@valtimo/exact-plugin`**

    The library `@valtimo/exact-plugin` has been removed. All of its code is now exported from `@valtimo/plugin`. Remove `@valtimo/exact-plugin` from your implementation's package.json if it's included, and change imports throughout your implementation from `@valtimo/exact-plugin` to `@valtimo/plugin`.
*   **Task management**

    Scope: front-end

    1. **Add dependency**

    Add the dependency `@valtimo/task-management` to your implementation. Make sure to run a fresh `npm install` after.

    2. **Import library**

    In `app.module.ts`, add the following line to the top of the file with the imports: `import {TaskManagementModule} from '@valtimo/task-management';`

    3. **Add task management module to imports**

    Add the previously imported `TaskManagementModule` to the `imports` array of your `AppModule`.

    4. **Add menu entry**

    Add the following line under the admin section in the menu configuration in the `environment` file of your implementation: `{link: ['/task-management'], title: 'Tasks', sequence: {UNIQUE_SEQUENCE_NUMBER}},` Replace `UNIQUE_SEQUENCE_NUMBER` with a unique sequence number, and make sure the sequence numbers of other menu items on the admin layer remain unique.
*   **Dark-mode and theme-switching**

    Scope: front-end

    1.  **Change stylesheets**

        In order for the themes to be displayed properly, the following change has to be made in the `styles` array in `angular.json` in the root of your implementation:

        * Change `"dist/valtimo/components/assets/css/carbon-beagle-compatibility.scss"` to `"dist/valtimo/components/assets/css/compatibility.scss"`, and make sure it is initiated **after** `"dist/valtimo/components/assets/css/carbon.scss"`
    2.  **Add logo variants**

        Next to `logoSvgBase64` and `logoPngBase64`, there is now also support for dark-mode variants called `darkModeLogoSvgBase64` and `darkModeLogoPngBase64`. In order for the logo's to be displayed properly in both light- and dark-mode, the following changes have to be made:

        *   Add the desired logos in **`logo.ts`**

            ```ts
            const LOGO_BASE_64 = 'Base 64 string for the light-mode (default) SVG logo goes here';

            const DARK_MODE_LOGO_BASE_64 = 'Base 64 string for the dark-mode SVG logo goes here';

            const LOGO_BASE_64_PNG = 'Base 64 string for the light-mode (default) PNG logo goes here';

            const DARK_MODE_LOGO_BASE_64_PNG = 'Base 64 string for the dark-mode PNG logo goes here';

            export {LOGO_BASE_64, DARK_MODE_LOGO_BASE_64, LOGO_BASE_64_PNG, DARK_MODE_LOGO_BASE_64_PNG};
            ```
        *   Import the logos and assign them in **`environment.ts`**

            ```ts
            /* Import the logo's from the logo.ts file */
            import {
              DARK_MODE_LOGO_BASE_64,
              DARK_MODE_LOGO_BASE_64_PNG,
              LOGO_BASE_64,
              LOGO_BASE_64_PNG,
            } from './logo';

            export const environment: ValtimoConfig = {
              logoSvgBase64: LOGO_BASE_64,
              darkModeLogoSvgBase64: DARK_MODE_LOGO_BASE_64,
              logoPngBase64: LOGO_BASE_64_PNG,
              darkModeLogoPngBase64: DARK_MODE_LOGO_BASE_64_PNG
            }
            ```

    The logo's should now automatically update when themes are switched.
