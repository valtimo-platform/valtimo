# Front-end migration

Migrating your Valtimo front-end implementation can be done both through a script and manually. Find instructions for both scenario's below.

### Migration script

#### Preparation

Before running the migration script, make sure your front-end implementation is running on the latest version of Valtimo 12. Check out to a clean Git branch specifically made for upgrading your implementation.

Next, determine whether you want to upgrade based on a version number, or based on a package URL. This will be your VALTIMO\_VERSION environment url. Valid examples for both cases:

* Version number: `VALTIMO_VERSION="13.0.0"`
* Package URL: `VALTIMO_VERSION="https://valtimo-snapshots.s3.eu-central-1.amazonaws.com/npm/snapshots/13.0.0"`

{% hint style="info" %}
It does not matter which Valtimo package is linked here, the correct URL will be constructed for each individual Valtimo dependency.
{% endhint %}

#### Running migration script

In the root directory of your front-end implementation, run the following command:

{% code overflow="wrap" %}
```
curl -L https://github.com/valtimo-platform/valtimo-frontend-libraries/archive/refs/tags/13.0.0.zip \
  -o valtimo-migration.zip && \
unzip -q valtimo-migration.zip 'valtimo-frontend-libraries-13.0.0/migration/*' && \
mv valtimo-frontend-libraries-13.0.0/migration ./migration && \
rm -rf valtimo-frontend-libraries-13.0.0 valtimo-migration.zip && \
VALTIMO_DEPS_SOURCE="https://raw.githubusercontent.com/valtimo-platform/valtimo-frontend-libraries/refs/tags/13.0.0/package.json" \
VALTIMO_VERSION="13.0.0" \
node migration/12-13/migrate.cjs
```
{% endcode %}

Do not forget to replace `VALTIMO_VERSION="XXX"` with the value you determined earlier.

{% hint style="info" %}
**Note**&#x20;

If the following command does not work, please contact any of the developers of the Valtimo product, and the command will be adjusted.
{% endhint %}

#### Migration script prompt

When first running the migration script, you will be presented with a prompt. Please read this carefully and follow its instructions precisely. After typing \`Y\` to continue, the migration script should automatically run and complete.

Angular migrations will present you with a couple of options. By default, enable them by pressing the space bar, and then press enter to continue.

The following prompts should be _disabled_, by pressing the space bar:

<figure><img src="../../../.gitbook/assets/undefined - Imgur.png" alt=""><figcaption></figcaption></figure>

The following prompt should be _enabled_, by pressing the space bar:

<figure><img src="../../../.gitbook/assets/undefined - Imgur (1).png" alt=""><figcaption></figcaption></figure>

#### After running the migration script

After finishing the migration script, try to build or start your application. There's a chance that there will be issues. These issues can be easily fixed by manually going over `angular.json` and `app.module.ts` and resolving any formatting or structural issues.

### Manual migration

Every front-end implementation is unique. If the aforementioned script wholly or partially fails, try migrating manually by following the steps below.

#### Angular 17 to 18

* Run `npm install`
* Run the Angular upgrade command

```
 ./node_modules/.bin/ng update @angular/core@18 @angular/cli@18 --force
```

* Commit the Angular upgrade with
  * `git add .`&#x20;
  * `git commit -m "Upgrade Angular from 17 to 18"`

#### Angular 18 to 19

* Run the Angular upgrade command

```
 ./node_modules/.bin/ng update @angular/core@19 @angular/cli@19 --force
```

* Commit the Angular upgrade with
  * `git add .`&#x20;
  * `git commit -m "Upgrade Angular from 18 to 19"`

#### BPMN Dependency Migration

* Update the following dependencies in `package.json` (move them from `devDependencies` to `dependencies` if necessary):

```json
{
    "@webcomponents/custom-elements": "1.6.0",
    "core-js": "3.36.0",
    "dmn-js": "12.3.0",
    "dropzone": "6.0.0-beta.2",
    "rxjs": "7.8.1",
    "swagger-ui": "5.4.2",
    "tslib": "2.6.2",
    "zone.js": "0.14.4",
    "@bpmn-io/dmn-migrate": "0.4.3",
    "@bpmn-io/properties-panel": "3.25.0",
    "bpmn-js": "18.0.0",
    "bpmn-js-properties-panel": "5.26.0",
    "camunda-bpmn-js-behaviors": "1.7.0",
    "camunda-bpmn-moddle": "7.0.1",
    "diagram-js": "15.2.1",
    "@ngx-translate/core": "16.0.4",
    "@ngx-translate/http-loader": "16.0.1"
  }
```

* In angular.json, replace the old BPMN CSS path if present:
  * Replace `node_modules/bpmn-js-properties-panel/dist/assets/bpmn-js-properties-panel.css` with `node_modules/@bpmn-io/properties-panel/dist/assets/properties-panel.css`
* Commit the changes with
  * `git add .`
  * `git commit -m "Migrate BPMN dependencies"`&#x20;

#### SSE Module Migration

* Add the `@valtimo/sse` dependency to `package.json`:
  * Use the same version or URL pattern as `@valtimo/access-control`
    *   If the `@valtimo/access-control` version is a URL like

        &#x20;`https://host/path/valtimo-access-control-<version>.tgz`

        then use the corresponding SSE package:

        `https://host/path/valtimo-sse-<version>.tgz`
* Run `npm install` to install the new dependency.
* Update `app.module.ts`:
  *   Add the import:

      `import { SseModule } from '@valtimo/sse';`&#x20;
  * Add `SseModule` to the `imports` array in the `@NgModule` decorator.
* In the `src/environments` directory:
  * Open each `.ts` file and remove any line containing `enableTaskPanel: true` or `enableTaskPanel: false`
* Commit the changes with
  * `git add .`
  * `git commit -m "Migrate to @valtimo/sse module"`&#x20;

#### Replace `@valtimo/config` with `@valtimo/shared`&#x20;

Recursively update all files in the project:

* Replace all imports of `@valtimo/config` with `@valtimo/shared` in files ending with `.js`, `.ts`, `.html`
* In `package.json`:
  * For each of `dependencies`, `devDependencies`, `peerDependencies`, and `optionalDependencies`:
    * If `@valtimo/config` exists, move its version to `@valtimo/shared`
    * Then remove the `@valtimo/config` entry
* In `angular.json`:
  * Replace all occurrences of `@valtimo/config` with `@valtimo/shared`
* Commit the changes with
  * `git add .`
  * `git commit -m "Replace @valtimo/config with @valtimo/shared"`

#### Sync Valtimo Dependencies Manually (Based on Version 13)

* Go to the following URL to access the `package.json` used for version 13:
  * `https://github.com/valtimo-platform/valtimo-frontend-libraries/blob/next-major/package.json`
* Open your local `package.json`.
* For each `dependency` and `devDependency`:
  * If the package name starts with `@valtimo/`:
    * If you are using a snapshot build:
      * Get the base URL from an existing snapshot dependency, such as `@valtimo/access-control`
        * Example:
          * If `@valtimo/access-control` uses
            * `https://host/path/valtimo-access-control-13.0.0-SNAPSHOT.tgz`,
          * then for `@valtimo/shared`, use
            * `https://host/path/valtimo-shared-13.0.0-SNAPSHOT.tgz`
    * If you are using a fixed version, use that version number (e.g., `13.0.0`) for all `@valtimo/*` dependencies
  * For any **non-`@valtimo/`** dependency that also exists in the major 13 `package.json`:
    * Copy the version from this `package.json` into your local `package.json`
  * Save the updated `package.json`.
  * Run `npm install`.
  * Commit the changes with:
    * `git add .`
    * `git commit -m "Sync Valtimo dependencies based on next-major branch"`&#x20;

#### Remove `ngx-toastr` CSS from `angular.json`&#x20;

* Open `angular.json`.
* In each file, find and replace the following:
  * Replace `title: 'Dossiers'`  with `title: 'Cases'`&#x20;
  * Replace `link: ['/dossier-management']`  with `link: ['/case-management']`&#x20;
* Save the updated files.
* Commit the changes with
  * `git add .`
  * `git commit -m "Replace dossier menu routes in environment files"`&#x20;

#### Replace `Dossier*` Symbols and `@valtimo/dossier*` Imports

* Search all `.ts` files under the `src/` directory.
* For every import from `@valtimo/*` that includes a symbol starting with `Dossier`:
  * Replace each such symbol by renaming `Dossier*` to `Case*` , (e.g., `DossierModule` → `CaseModule`)
* Update import paths:
  * Replace `from '@valtimo/dossier'`  with `from '@valtimo/case'`&#x20;
  * Replace `from '@valtimo/dossier-management'`  with `from '@valtimo/case-management'`&#x20;
* Update `package.json`:
  * In both `dependencies` and `devDependencies`, replace:
    * `@valtimo/dossier` → `@valtimo/case`
    * `@valtimo/dossier-management` → `@valtimo/case-management`
  * If the version string is a URL (e.g., to a `.tgz` file), update the filename accordingly:
    * `valtimo-dossier-...tgz` → `valtimo-case-...tgz`
    * `valtimo-dossier-management-...tgz` → `valtimo-case-management-...tgz`
* Save all modified files.
* Run `npm install`.
* Commit the changes with
  * `git add .`
  * `git commit -m "Replace Dossier* symbols and @valtimo/dossier* imports"`

#### Clean Up Deprecated Environment Properties and Routes

* In each `.ts` file inside the `src/environments` directory:
  *   Remove the `customDefinitionTables` property.

      Example pattern to remove:

      ```typescript
      customDefinitionTables: {
            leningen: [ ... ]
          }
      ```
  *   Replace the following block:

      `definitions: { dossiers: [] }`

      with

      `definitions: { cases: [] }`
  * From any route configuration arrays (usually under a `menu` or `routes` array), remove route objects where the path is:
    * `'process-link'`
    * `'process-links'`
    * `'form-flow'`
  * Ensure there are no trailing commas after removing any object from arrays or properties.
* Run `npm install`.
* Commit the changes with
  * `git add .`
  * `git commit -m "Remove deprecated env properties and routes"`

#### Ensure `skipLibCheck` and `moduleResolution` in `tsconfig.json`

* Open the root `tsconfig.json` file.
* Under `compilerOptions`, make sure the following options are set:
  * `"skipLibCheck": true`
    * Add this if it doesn't exist or is not set to `true`.
  * `"moduleResolution": "bundler"`
    * Set or replace this value to ensure it is `"bundler"`.
* Save the file.
*   Make sure the updated section in `tsconfig.json` looks like this:

    ```json
    {
        "compilerOptions": {
          "skipLibCheck": true,
          "moduleResolution": "bundler"
        }
      }
    ```
* Commit the changes with
  * `git add .`
  * `git commit -m "Set skipLibCheck and moduleResolution in tsconfig.json"`

#### Update Router `errorHandler` in `AppRoutingModule`

* Open `src/app/app-routing.module.ts`.
* If the file contains the legacy `this.router.errorHandler = () => { this.router.navigate(['']); };`, remove that line.
* Remove the following if present:
  * The `Router` import (i.e., `, Router`)
  * The `constructor(private router: Router) { ... }` block, if it only sets the `errorHandler`
* Update the `RouterModule.forRoot(routes)` call to use the new `errorHandler` option:
  * From: `RouterModule.forRoot(routes)`
  *   To:

      ```
      RouterModule.forRoot(routes, {
      errorHandler: error => {
      window.location.href = '/';
      }
      })
      ```
* Save the file.
* Commit the changes with
  * `git add .`
  * `git commit -m "Update router errorHandler to new format"`

#### Clean Up `AppModule` Imports and Declarations

* Open `src/app/app.module.ts`.
* Remove the import statement for the following modules from `@valtimo/components` if present:
  * `CardModule`
  * `ListModule`
  * `ButtonModule`
  * `PageModule`
  * `TitleModule`
  * `VCardModule`
* Remove all occurrences of these modules from arrays like `imports`, `declarations`, etc.
* Remove any usage of `CaseDetailTabContactMomentsComponent`:
  * From arrays such as `declarations`, `entryComponents`, etc.
  * From object properties like: `contactmomenten: CaseDetailTabContactMomentsComponent`
* Remove the import and usage of `HttpClientModule`:
  * Delete its import statement
  * Remove it from `imports` or other NgModule arrays
* Save the file.
* Commit the changes with
  * `git add .`
  * `git commit -m "Clean up AppModule: remove unused modules and component"`

#### Migrate `proxy.conf.json` Files

* Recursively search for all `proxy.conf.json` files in the project (excluding `node_modules` and `dist` folders).
* In each `proxy.conf.json` file, apply the following changes:
  * If a proxy path ends with `/*` (e.g., `"/some/path/*"`), change it to end with `/**`, unless it already ends with `/**`.
    * Example:
      * Change `"/api/*"` to `"/api/**"`
      * For the path `"/api/*"`:
        * Set `"changeOrigin": false`
      * For the path `"/management/*"`:
        * Change the path key to `"/api/management/**"`
* Save the modified `proxy.conf.json` files.
* Commit the changes with
  * `git add .`
  * `git commit -m "Migrate proxy.conf.json to new path format and options"`
