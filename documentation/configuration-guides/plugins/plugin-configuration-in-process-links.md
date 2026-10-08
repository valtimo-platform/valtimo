# Plugin configuration in process links

{% hint style="success" %}
Available since Valtimo `13.49.1`
{% endhint %}

A plugin process link names the plugin configuration whose action it runs. In a deployed
`.process-link.json` file that configuration can be a fixed id, an environment setting that is
filled in when the file is deployed, or a value that is looked up every time the action runs, such
as a process variable. This lets the same process links be used in every environment and by every
organization, each with its own plugin configurations.

---

## Ways to name the plugin configuration

The plugin configuration is set in the `pluginConfigurationId` field of a plugin process link.

| Value of `pluginConfigurationId` | Resolved | Example |
|----------------------------------|----------|---------|
| A plugin configuration id | Never: the link always uses this configuration | `"7b1c0a52-2a4e-4d0e-9a51-1f0e4d2c9a01"` |
| An environment placeholder | Once, when the file is deployed | `"${valtimo.zaken-api.configuration-id}"` |
| A value-resolver expression | Every time the activity runs, per process instance | `"pv:zakenApiConfigurationId"` |

Process links with a fixed plugin configuration id work as before.

---

## Using an environment setting

An environment placeholder is written as `${name}`, or `${name:default}` to fall back to a default
value when the setting is empty or missing. When the file is deployed, the placeholder is replaced
by the value of the application property `name`. That value must be the id of a plugin
configuration in that environment.

The same notation can be used in `pluginActionDefinitionKey`, for example when an environment uses
a different action of the same plugin.

<details>
<summary>Process link with an environment placeholder</summary>

```json
[
    {
        "activityId": "CreateZaak",
        "activityType": "bpmn:ServiceTask:start",
        "processLinkType": "plugin",
        "pluginConfigurationId": "${valtimo.zaken-api.configuration-id}",
        "pluginActionDefinitionKey": "create-zaak",
        "actionProperties": {}
    }
]
```

</details>

Placeholders are replaced only when both of these are true:

| Condition | Description |
|-----------|-------------|
| The file is autodeployed | Placeholders are replaced in the configuration files the application deploys when it starts. They are not replaced in a file uploaded through the import screen. |
| The name is whitelisted | The property name must match one of the patterns in `valtimo.import.whitelistedPaths`. The default is `valtimo.*`, so only properties whose name starts with `valtimo.` are replaced. The patterns keep other properties, such as passwords, out of imported files. |

A property such as `valtimo.zaken-api.configuration-id` can be set in the application
configuration or as the environment variable `VALTIMO_ZAKEN_API_CONFIGURATION_ID`.

The link is stored with the configuration id the placeholder was replaced with, as if that id had
been written in the file.

### When the placeholder is not replaced

A missing setting or a name that is not whitelisted does not stop the deployment or the application
start. Instead:

| Field | What happens |
|-------|--------------|
| `pluginConfigurationId` | An error is logged that names the field, the activity, and the placeholder, and explains the whitelist. The process link is stored without a plugin configuration. The case definition shows it under [Missing plugin configurations](../cases/general.md#missing-plugin-configurations), where a configuration can be selected. Until then, the activity fails when it runs. |
| `pluginActionDefinitionKey` | An error is logged that names the field, the activity, and the placeholder. The process link is stored as written, and the activity fails when it runs. |

The same applies to a `pluginConfigurationId` that is neither a plugin configuration id nor a
supported value-resolver expression: the error names the value, and the link is stored without a
plugin configuration.

---

## Using a value per process instance

A value-resolver expression in `pluginConfigurationId` is resolved each time the activity runs.
Any prefix that can be used in action properties can be used here, such as `pv:` for a process
variable, `doc:` for a field of the case document, or `case:` for case data. The resolved value must
be the id of a plugin configuration.

A process link with a value-resolver expression must also contain `pluginDefinitionKey`, the key of
the plugin the action belongs to. A process link without it is rejected when it is deployed.

<details>
<summary>Process link with a process variable</summary>

```json
[
    {
        "activityId": "CreateZaak",
        "activityType": "bpmn:ServiceTask:start",
        "processLinkType": "plugin",
        "pluginConfigurationId": "pv:zakenApiConfigurationId",
        "pluginDefinitionKey": "zakenapi",
        "pluginActionDefinitionKey": "create-zaak",
        "actionProperties": {}
    }
]
```

</details>

Two process instances with a different `zakenApiConfigurationId` run the action on two different
plugin configurations.

When the expression does not lead to a usable plugin configuration, the activity fails with a
message that names the activity, the expression, and the resolved value:

| Resolved value | Message |
|----------------|---------|
| Empty or missing | The expression resolved to no value |
| Not a plugin configuration id | The value is not a plugin configuration id |
| An id without a plugin configuration | No plugin configuration with that id exists |
| A configuration of another plugin | The configuration belongs to a different plugin than `pluginDefinitionKey` |

{% hint style="info" %}
An exported process definition writes the expression to the field
`pluginConfigurationIdExpression`. Both that field and an expression in `pluginConfigurationId` are
accepted when the file is deployed or imported again.
{% endhint %}

### Limitations

| Area | Limitation |
|------|------------|
| Process-link editor | The editor does not show or change the expression. Saving changed action properties in the editor keeps the stored expression. |
| Building blocks | Process links in a building block always take their plugin configuration from the building block's plugin configuration mappings. An expression in a building block's process link is removed when the building block is imported. |
| External plugins | Process links of external plugins do not support a value-resolver expression and are rejected. |
| Message start events | No process instance exists before a message starts the process, so the expression cannot be resolved there. A warning is logged when such a process link is deployed. |
| Lookups by plugin configuration | Features that look up process links by their plugin configuration, such as the Portaaltaak plugin's receive data, the Notificaties API subscriptions, and the Documenten API version detection, do not find process links with a value-resolver expression. |
