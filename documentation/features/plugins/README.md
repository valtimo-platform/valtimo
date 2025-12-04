# 🔌 Plugins

Plugins are extensions on the Valtimo platform, allowing connections to other services, whether external or internal. Some plugins are provided by the platform, but developers can create their own as well.

Plugins consist of several parts; the definition itself, dictating both the properties that can be configured and the actions the plugin can run. The concepts are all explained below.

## Concepts

* **Plugin definition.** A regular plugin is often referred to as a plugin definition to emphasize the difference between the definition of the plugin and the configuration of a plugin. For example, a Twitter plugin can also be referred to as a Twitter plugin definition.
* **Plugin configuration.** A single plugin can be configured multiple times. For example, a Twitter plugin might have one configuration to post tweets for one user and another configuration to post tweets for another user.
* **Plugin property.** A plugin configuration can have multiple configurable properties. For example, a Twitter plugin configuration can have the properties `username` and `password`.
* **Plugin action.** A plugin can have several actions it can execute. For example, a Twitter plugin might have one action to post a tweet and another action to like a tweet.
* **Plugin event.** A plugin might have methods that need to be run when the Plugin is created, updated or deleted. For example, a plugin needs approval from an external service for its instantiation.
* **Plugin action property.** An action can have several properties that can be configured differently, depending on the process instance or process definition. For example, a Twitter plugin action which posts a tweet would include both the user and the message.

Plugins can be configured in the plugin menu in Valtimo. The plugin menu is found under the admin menu. Admin privileges are required to configure plugins.

Instructions for using the configuration to link an action to a process task can be found [here](../process/process-link.md#creating-a-plugin-process-link).

### ZGW plugins

For the GZAC edition additional plugins are available: the ZGW or Zaakgericht werken plugins. These support integration with implementations of the following API standards: Zaken, Documenten, Catalogi and Objecten. Additional plugins are included for integration with the most commons implementation, e.g. Open Zaak.

The available ZGW plugins are:

* Besluiten plugin
* Catalogi API plugin
* Documenten API plugin
* Notificaties API plugin
* Object Token Authentication plugin
* Objecten API plugin
* Objecttypen API plugin
* Open Zaak plugin
* Portaaltaak plugin
* Verzoek plugin
* Zaken API plugin

## Configuring plugins

{% hint style="info" %}
Before plugins can be configured, both the backend and frontend dependencies are needed. See [here](../../fundamentals/getting-started/modules/core/plugin.md) for instructions on how to do this.
{% endhint %}

{% tabs %}
{% tab title="Via UI" %}
* Go to the `Admin` menu
* Go to the `Plugin` menu
* Click on **Configure plugin**
* Select the plugin definition
* Configure the plugin

![Configuring a plugin](../../.gitbook/assets/configure-plugin.png)
{% endtab %}

{% tab title="Via IDE" %}
Plugin configurations can also be deployed when starting the application.

This can be done by creating one or more files anywhere on the classpath (resource folder) matching the following pattern: `*.pluginconfig.json`

An example configuration can be found below:

```json
[
  {
    "id": "e6525773-1863-4e92-92a1-9ed79508a819",
    "title": "Example plugin configuration",
    "pluginDefinitionKey": "example",
    "properties": {
      "someProperty": "value",
      "someSecret": "${SOME_VALUE}"
    }
  },
  {
    ...
  }
]
```

The id (UUID) of the plugin should be generated manually. The same id's should be used when referencing configurations at the [plugin processlink auto-deployment](broken-reference).

The available properties can be found in the documentation of the plugin.

Values within the `properties` attribute can be resolved by using the `${SOME_VALUE}` syntax. The `SOME_VALUE` is then retrieved from an environment variable. If no environment variable with that name is found, the variable is retrieved from a Java system property.

**Important:** You must explicitly whitelist which environment variables can be used in these files. Add the following to your
`application.yml`:

```yaml
valtimo:
  imports:
    whitelistedPaths:
      - "VALTIMO_.*"
      - "GZAC_.*"
```

This ensures that only environment variables matching the given patterns are available in the deployment file.

{% endtab %}
{% endtabs %}
