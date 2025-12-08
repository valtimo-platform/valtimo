# Back-end migration

## Dependency changes

#### Published libraries

These are the changes that were made to the Valtimo libraries that get published:

<table><thead><tr><th width="222">Module</th><th>Change</th></tr></thead><tbody><tr><td><code>besluit</code></td><td>Removed. Use <code>besluiten-api</code> instead.</td></tr><tr><td><code>connector</code></td><td>Removed. Use plugins instead.</td></tr><tr><td><code>contactmoment</code></td><td>Removed.</td></tr><tr><td><code>document</code></td><td>Merged into <code>case</code>. Packages are the same.</td></tr><tr><td><code>external-event</code></td><td>Removed. Partially replaced by <code>portaaltaak</code>, specifically for tasks.</td></tr><tr><td><code>form-flow-valtimo</code></td><td>Merged into <code>form-flow</code>. Packages are the same.</td></tr><tr><td><code>haalcentraal</code></td><td>Removed.</td></tr><tr><td><code>haalcentraal-brp</code></td><td>Removed.</td></tr><tr><td><code>klant</code></td><td>Removed.</td></tr><tr><td><code>objects-api</code></td><td>Removed. Use other ZGW modules instead.</td></tr><tr><td><code>openzaak</code></td><td>Removed. Use other ZGW modules instead.</td></tr><tr><td><code>openzaak-resource</code></td><td>Removed. Use other ZGW modules instead.</td></tr></tbody></table>

#### Used libraries

<table><thead><tr><th width="406">Library</th><th width="222">Previous version</th><th width="227">Current version</th></tr></thead><tbody><tr><td>Camunda</td><td><code>7.21.0</code></td><td>Replaced with Operaton equivalent of <code>7.23.0</code>.</td></tr><tr><td><code>com.mysql:mysql-connector-j</code></td><td><code>8.4.0</code></td><td><code>9.2.0</code></td></tr><tr><td><code>org.liquibase:liquibase-core</code><br><code>org.liquibase.ext:liquibase-hibernate6</code></td><td><code>4.29.2</code></td><td><code>4.31.1</code></td></tr><tr><td><code>org.keycloak:keycloak-admin-client</code><br><code>org.keycloak:keycloak-server-spi-private</code></td><td><code>24.0.5</code></td><td><code>26.0.5</code></td></tr><tr><td><code>org.postgresql:postgresql</code></td><td><code>42.7.4</code></td><td><code>42.7.5</code></td></tr><tr><td><code>org.springframework.boot</code></td><td><code>3.2.5</code></td><td><code>3.4.5</code></td></tr></tbody></table>

## Case definitions

With the introduction of case definitions, the structure inside your `resources` folder will change. Additionally, some configuration files have new extensions, to further differentiate between what is configured. The tables below show what changes are made for Valtimo and ZGW resources.

{% tabs %}
{% tab title="Core Valtimo" %}
<table><thead><tr><th>Resource type</th><th>Old location</th><th width="186">New location</th><th>Notes</th></tr></thead><tbody><tr><td>BPMN</td><td><code>/**/bpmn/*.bpmn</code></td><td><code>/config/case/*/*/bpmn/*.bpmn</code></td><td>-</td></tr><tr><td>Case definition</td><td>-</td><td><code>/config/case/*/*/case/definition/*.case-definition.json</code></td><td>Replaces case settings. Click <a href="https://app.gitbook.com/o/yIYH93lNsNEOoIWOawxF/s/q5dx9HWFJGshztp4binE/~/changes/12/release-notes/13.x.x/13.0.0/migration#case-definition">here</a> for details.</td></tr><tr><td>Case list column</td><td><code>/config/case/list/*.json</code></td><td><code>/config/case/*/*/case/list/*.case-list.json</code></td><td>-</td></tr><tr><td>Case search field</td><td><code>/config/search/*.json</code></td><td><code>/config/case/*/*/case/search-field/*.schema.case-search-field.json</code></td><td>-</td></tr><tr><td>Case settings</td><td><code>/config/case/definition/*.json</code></td><td>-</td><td>Replaced by case definition.</td></tr><tr><td>Case tab</td><td><code>/config/case-tabs/*.case-tabs.json</code></td><td><code>/config/case/*/*/case/tab/*.case-tab.json</code></td><td>Structure changed, see below.</td></tr><tr><td>Case tag</td><td><code>/config/case-tag/*.json</code></td><td><code>/config/case/*/*/case/tag/*.case-tag.json</code></td><td>Structure changed, see below.</td></tr><tr><td>Case task list</td><td><code>/config/case-task-list/*.case-task-list.json</code></td><td><code>/config/case/*/*/case/task-list/*.case-task-list.json</code></td><td>Structure changed, see below.</td></tr><tr><td>Case widget tab</td><td><code>/config/case-widget-tab/*.case-widget-tab.json</code></td><td><code>/config/case/*/*/case/widget-tab/*.case-widget-tab.json</code></td><td>Structure changed, see below.</td></tr><tr><td>DMN</td><td><code>/**/dmn/*.dmn</code></td><td><code>/config/case/*/*/dmn/*.dmn</code></td><td>-</td></tr><tr><td>Document</td><td><code>resource/config/document/definition/*.schema.json</code></td><td><code>/config/case/*/*/document/definition/*.schema.document-definition.json</code></td><td>-</td></tr><tr><td>Form</td><td><code>/config/form/*.json</code></td><td><code>/config/case/*/*/form/*.form.json</code></td><td>-</td></tr><tr><td>Form flow</td><td><code>/config/form-flow/*.form-flow.json</code></td><td><code>/config/case/*/*/form-flow/*.form-flow.json</code></td><td>-</td></tr><tr><td>Global BPMN</td><td><code>/**/bpmn/*.bpmn</code></td><td><code>/config/global/bpmn/*.bpmn</code></td><td>-</td></tr><tr><td>Global DMN</td><td><code>/**/dmn/*.dmn</code></td><td><code>/config/global/dmn/*.dmn</code></td><td>-</td></tr><tr><td>Internal case status</td><td><code>/config/internal-case-status/*.internal-case-status.json</code></td><td><code>/config/case/*/*/case/internal-status/*.internal-case-status.json</code></td><td>Structure changed, see below.</td></tr><tr><td>Process document link</td><td><code>/config/process-document-link/*.json</code></td><td><code>/config/case/*/*/process-document-link/*.process-document-link.json</code></td><td>-</td></tr><tr><td>Process link</td><td><code>/config/processlink/*.processlink.json</code></td><td><code>/config/case/*/*/process-link/*.process-link.json</code></td><td>-</td></tr><tr><td>Task search field</td><td><code>/config/task-search-fields/*.task-search-field.json</code></td><td><code>/config/case/*/*/task-search-field/*.task-search-field.json</code></td><td>Structure changed, see below.</td></tr></tbody></table>
{% endtab %}

{% tab title="ZGW" %}
| Resource type               | Old location                                               | New location                                                                  | Notes                                                                                                                                                                   |
| --------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documenten API upload field | `/config/zgw/*.zgw-document-upload-fields.json`            | `/config/case/*/*/zgw/document-upload-field/*.zgw-document-upload-field.json` | Structure changed, see below.                                                                                                                                           |
| Zaak type link              | -                                                          | `/config/case/*/*/zgw/zaak-type-link/*.zaak-type-link.json`                   | New, click [here](https://app.gitbook.com/o/yIYH93lNsNEOoIWOawxF/s/q5dx9HWFJGshztp4binE/~/changes/12/release-notes/13.x.x/13.0.0/migration#zaak-type-link) for details. |
| ZGW document list column    | `/config/documenten-api/*.zgw-document-list-column.json`   | `/config/case/*/*/zgw/document-list-column/*.zgw-document-list-column.json`   | Structure changed, see below.                                                                                                                                           |
| ZGW document trefwoord      | `/config/case-trefwoorden/*.zgw-document-trefwoorden.json` | `/config/case/*/*/zgw/trefwoord/*.zgw-document-trefwoord.json`                | Structure changed, see below.                                                                                                                                           |
{% endtab %}
{% endtabs %}

#### Migrating contents to their new structure

Some resources have also either had their structure change, as can be seen in the **Contents updated** column in the table above. With the introduction of versioning for case definitions, case related configuration files no longer have to depend on changesets. Additionally, each case definition should have its own configuration files. These changesets always followed the following pattern:

```json
{
    "changesetId": "...",
    "case-definitions": [
        {
            "key": "...",
            "...": [
                <the actual configuration>
            ]
        }
    ]
}
```

These can now be simplified to the following pattern:

```
[
    <the actual configuration>
]
```

#### New resources

{% tabs %}
{% tab title="Case definition" %}
Case definitions adhere to the following structure:

```json
{
    "key": "...",
    "name": "...",
    "versionTag": "1.0.0",
    "final": true,
    "canHaveAssignee": true,
    "autoAssignTasks": true
}
```

* `key`. The key is the key of your case definition.
* `name`. The name is the name of your case definition.
* `versionTag`. Version tag in combination with case definition key has to be unique, and as long as a case definition is not yet final it can still be edited, and configurations can be updated as well. The version tag follows semantic versioning, so `1.0.0-something`.
* `canHaveAssignee`. Determines if users can be assigned to a case.
* `autoAssignTasks`. Automatically assigns user tasks to the user assigned to the case. This can only be set to true if `canHaveAssignee` is enabled as well.
{% endtab %}

{% tab title="Zaak type link" %}
Zaak type links adhere to the following structure:

```json
{
    "zaakTypeUrl": "...",
    "zakenApiPluginConfigurationId": "...",
    "createWithDossier": true,
    "rsin": "000000000"
}

```

* `zaakTypeUrl`. The URL of the zaak type.
* `zakenApiPluginConfigurationId`. ID of the Zaken API plugin configuration that should be used for this zaak type.
* `createWithDossier`. Determines if a Zaak be created when the document corresponding to this case is created.
* `rsin`. Legal Entities and Partnerships Information Number.
{% endtab %}
{% endtabs %}

#### Case definition permissions

Case definition is a newly introduced resource. Some existing functionality now checks for this permission, such as the list of cases that can be selected in the left panel. Below is the list of resource and action type combinations that have been added, as well as when to use them/when they are used. Do not forget to configure these permissions for your Valtimo implementation.

| Resource                                             | Action      | When to use                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `com.ritense.case_.domain.definition.CaseDefinition` | `view`      | <ul><li>When retrieving which case definition columns to show.</li><li>When retrieving an individual case definition.</li><li>When retrieving the available case tags for a case definition.</li><li>When retrieving the available internal case statuses for a case definition.</li></ul> |
| `com.ritense.case_.domain.definition.CaseDefinition` | `view_list` | <ul><li>When retrieving a list of case definitions, e.g. the list of cases in the left panel in the UI. This does not include related content, such as document details.</li></ul>                                                                                                         |

#### ZGW Object management permissions

Access to objects in the Objecten API is now granted via permissions. Below is the list of resource and action type combinations, as well as when they are used. Do not forget to configure these permissions for your Valtimo implementation.

| Resource                                  | Action      | When to use                                                                                     |
| ----------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| `com.ritense.objectenapi.security.object` | `create`    | <ul><li>When creating an object via the Objecten API.</li></ul>                                 |
| `com.ritense.objectenapi.security.object` | `delete`    | <ul><li>When deleting an object via the Objecten API.</li></ul>                                 |
| `com.ritense.objectenapi.security.object` | `modify`    | <ul><li>When editing an object via the Objecten API.</li></ul>                                  |
| `com.ritense.objectenapi.security.object` | `view`      | <ul><li>When viewing a single object via the Objecten API.</li></ul>                            |
| `com.ritense.objectenapi.security.object` | `view_list` | <ul><li>When retrieving a list of objects, e.g. a list of objects for an object type.</li></ul> |

## Operaton

With Camunda 7 going end of life, Valtimo now uses Operaton as its process engine.The effort involved in the migration to Operaton depends on the level of Camunda integration in the implementation project. Operaton works on the same database structure Camunda uses, so no further migration is needed. If Camunda is used or referenced in your custom code, this will likely require changes.

#### UI only:

* No changes are required

#### Config deployed on startup:

* Permissions need to be updated
* Camunda properties in the application configuration

#### Custom code:

* Direct references to Camunda should be replaced in for example:
  * Valtimo class names
  * imports of Camunda classes

#### Infrastructure:

* Camunda webapps configuration needs to be changed.

### Permission changes

Some resources that permissions apply to have been renamed. Anything referencing Camunda in your permission configuration needs to be changed. **This only applies to the configuration files loaded on startup.** Any permissions in the database, like those previously imported or configured through the UI should be automatically migrated. These change apply to main resource type of the Permission and any resources used on container type conditions.

<table data-full-width="true"><thead><tr><th>Before</th><th>After</th></tr></thead><tbody><tr><td><pre class="language-json"><code class="lang-json">{
    "resourceType": "com.ritense.valtimo.camunda.domain.CamundaTask",
    "action": "view",
    "roleKey": "ROLE_USER",
    "conditions": [
        {
            "type": "container",
            "resourceType": "com.ritense.valtimo.camunda.domain.CamundaIdentityLink",
            "conditions": [
                {
                    "type": "field",
                    "field": "groupId",
                    "operator": "==",
                    "value": "ROLE_USER"
                }
            ]
        }
    ]
},
</code></pre></td><td><pre class="language-json"><code class="lang-json">{
    "resourceType": "com.ritense.valtimo.operaton.domain.OperatonTask",
    "action": "view",
    "roleKey": "ROLE_USER",
    "conditions": [
        {
            "type": "container",
            "resourceType": "com.ritense.valtimo.operaton.domain.OperatonIdentityLink",
            "conditions": [
                {
                    "type": "field",
                    "field": "groupId",
                    "operator": "==",
                    "value": "ROLE_USER"
                }
            ]
        }
    ]
},
</code></pre></td></tr></tbody></table>

The following resources have been renamed, note that this is both the package and the class name:

| Old resource type name                                        | New resource type name                                          |
| ------------------------------------------------------------- | --------------------------------------------------------------- |
| `com.ritense.valtimo.camunda.domain.CamundaTask`              | `com.ritense.valtimo.operaton.domain.OperatonTask`              |
| `com.ritense.valtimo.camunda.domain.CamundaExecution`         | `com.ritense.valtimo.operaton.domain.OperatonExecution`         |
| `com.ritense.valtimo.camunda.domain.CamundaIdentityLink`      | `com.ritense.valtimo.operaton.domain.OperatonIdentityLink`      |
| `com.ritense.valtimo.camunda.domain.CamundaProcessDefinition` | `com.ritense.valtimo.operaton.domain.OperatonProcessDefinition` |

### Other changes in the codebase

Other changes required are impossible to list because they depend on how Camunda is used on the Valtimo project. These changes are generally simple and involve renaming Camunda to Operaton. Below are a number of examples of typical changes that need to be made.

#### Application configuration

References to Camunda properties in the application configuration should be changed. Usually this is done in `applcation.yml`

<table><thead><tr><th>Before</th><th>After</th></tr></thead><tbody><tr><td><pre class="language-yaml"><code class="lang-yaml">spring:
    jersey:
        application-path: /api/camunda-rest
camunda:
bpm:
history-level: AUDIT
history-level-default: AUDIT

</code></pre></td><td><pre class="language-yaml"><code class="lang-yaml">spring:
jersey:
application-path: /api/operaton-rest
operaton:
bpm:
history-level: AUDIT
history-level-default: AUDIT

</code></pre></td></tr></tbody></table>

#### Camunda packages

Camunda classes that are imported will have new package names. This is fixed by renaming `org.camunda` to `org.operaton` in imports.

<table><thead><tr><th>Before</th><th>After</th></tr></thead><tbody><tr><td><pre class="language-java"><code class="lang-java">import org.camunda.bpm.engine.RuntimeService
</code></pre></td><td><pre class="language-java"><code class="lang-java">import org.operaton.bpm.engine.RuntimeService
</code></pre></td></tr></tbody></table>

#### Class names

Both Camunda and Valtimo classes the have Camunda in the name have been changed. This is fixed by renaming Camunda to Operaton in the codebase.

<table><thead><tr><th>Before</th><th>After</th></tr></thead><tbody><tr><td><pre class="language-kotlin"><code class="lang-kotlin">@Bean
fun myBean(
    taskService: CamundaTaskService
): MyBean {
    //...
}
</code></pre></td><td><pre class="language-kotlin"><code class="lang-kotlin">@Bean
fun myBean(
    taskService: OperatonTaskService
): MyBean {
    //...
}
</code></pre></td></tr></tbody></table>

### Camunda webapps

The Camunda webapps have been replaced by the Operaton equivalent. The url on which they are available has only been changed from `https://host/camunda/app/` to `https://host/operaton/app/` . This might required additional infrastructure changes to allow access to the correct path.

## Minor migrations

#### Permission changes to user ID

A reference to a user is stored as part of a document (case handler), task (assignee) or note (creator). Because the option to pick what user identifier to use was removed, and username is used by default, this might have an impact on the configured permissions.

Lets say you have a permission where only the user who created a note for a case can delete that note. If Valtimo was set to use the user ID before, your permission might look like this.

```json
{
    "resourceType": "com.ritense.note.domain.Note",
    "action": "delete",
    "conditions": [
        {
            "type": "field",
            "field": "createdByUserId",
            "operator": "==",
            "value": "${currentUserId}"
        }
    ]
}
```

Note the use of the `${currentUserId}` expression. This will not match the username stored for the notes, resulting in users not being able to delete their notes. Instead this should be changed to `${currentUsername}` , resulting in the following permission.

```json
{
    "resourceType": "com.ritense.note.domain.Note",
    "action": "delete",
    "conditions": [
        {
            "type": "field",
            "field": "createdByUserId",
            "operator": "==",
            "value": "${currentUsername}"
        }
    ]
}
```

#### Document content

For security reasons, the document content has been removed from endpoints returning documents. For example `GET /api/v1/document/{documentId}` and `POST /api/v1/document-definition/name/search`. We recommend not exposing this information, as that can lead to users accessing case information that they should not have accesss to. Only the required information can be displayed using list columns, form-io, widget or summary tabs.\
\
If you still do want to return document content in these endpoints it is possible to turn this back on by enabling the following property.

```yaml
valtimo:
    includeDocumentContentInResponse: true
```

#### Removed authorization toggles

The following deprecated toggles for authorization purposes were removed:

```yaml
valtimo:
    authorization:
        objectenapi:
            enabled: true
        dashboard:
            enabled: true
        zgwDocuments:
            enabled: true
```

If your project made use of these toggles, these can now be removed. Additionally, permissions should be configured to allow access to these resources.

## Database migration script

As with other versions of Valtimo, a migration script will automatically run on startup to apply the required database changes. For this version the changes are more extensive than usual because of the introduction of case definitions. After the migration the application should continue running existing cases as usual. For projects that use more custom code that might be impacted, some of the migration steps will be explained here so you can better judge if any additional steps are required.

It is strongly recommend making a database backup before deploying the new version.

### Case definitions

Because of the introduction of case definitions, all cases should be linked to a case definition. This determines what configuration is used when working with this case. For example, which (version of) forms are used for user tasks, which tabs are displayed the detail page of that case or what supporting processes can be started. The migration script will set up a number of case definitions with the other configuration based on how the application would have behaved up until now.

The migration script does the following:

* A case definition is created for every version of a document definition. The key of the case definition matches the old key of the document definition. The version of the case definition is also based on the version of the document definition and will always have the `migrated` suffix. For example, a document definition of version `7` will result in a case definition with version `0.7.0-migrated` .
* The document definition is linked to the newly created case definition.
* Process definitions are copied to the new case definition. The processes that are copied are any process that were linked to the document definition. If other processes were started in a call activity, these process definitions are also copied. These copies are always based on the latest version of the process definition as this would also be the one that is started for major 12. Running processes are still linked to documents as they were before and will use the old process definition. Only newly started processes will use these new process definitions.
* Copy and link the following configurations the new case definition:
  * Case tabs (including widgets).
  * Case tags.
  * Linked ZGW zaak types.
  * Forms. The forms that are copied are the ones used in:
    * Process links
    * Summary forms
    * FormIO tabs
    * FormIO widgets
    * Form flows
  * Form flows. The form flows that are copied are the ones used in process links.
  * Process links are copied together with the process definitions.
  * Decision definitions are copied to the new case definition if these decisions are used in any of the related process definitions.

### Configuration changes

By default, it is not possible to modify draft case definitions in production environments. This can and should be enabled in the `application.yml` under `valtimo.draft.enabled`:

```yaml
valtimo:
  draft:
    enabled: true
```

## Environment variables

### What Changed

In Valtimo 13, **only whitelisted environment variables** can be used in auto-deployment configuration files. This restriction was added for **security reasons**, so sensitive system variables can’t be accessed unintentionally.

Whitelist patterns are configured in application.yml under valtimo.imports.whitelistedPaths:

### Migration Guide

1. Review your auto-deployment configuration files
   * Identify all environment variables currently in use.
2. Update the whitelist
   * Add regex patterns or exact names for all variables you need in the `application.yml` under `valtimo.imports.whitelistedPaths`:

```yaml
valtimo:
  imports:
    whitelistedPaths:
      - "VALTIMO_.*"
      - "GZAC_.*"
```
