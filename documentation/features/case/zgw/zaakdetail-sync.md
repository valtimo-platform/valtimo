# Zaakdetail sync

Zaakdetail sync allows case data to be automatically synchronized with the Objecten API. When enabled, changes to a
case are reflected in the configured object management configuration.

## Configuring zaakdetail sync

{% tabs %}
{% tab title="Via UI" %}
Navigate to `Admin > Cases > {Case name} > [ZGW] > [Zaakdetail sync]` to configure the synchronization settings. Select
the object management configuration and enable or disable the sync.
{% endtab %}

{% tab title="Via IDE" %}
Zaakdetail sync configuration can be loaded via auto-deployment. To do so, create a JSON file under the following path:

`*/resources/config/case/{case-definition-key}/{version-tag}/zgw/zaakdetail-sync/`

The file name should end with `.zaakdetail-sync.json` (e.g. `my-case.zaakdetail-sync.json`).

{% code title="my-case.zaakdetail-sync.json" %}
```json
{
    "objectManagementConfigurationId": "29400564-d25f-491c-abb2-afc42894ac9d",
    "enabled": true
}
```
{% endcode %}

| Property                         | Description                                                             |
| -------------------------------- | ----------------------------------------------------------------------- |
| `objectManagementConfigurationId`| The UUID of the object management configuration to sync with.           |
| `enabled`                        | Whether the sync is enabled (`true`) or disabled (`false`).             |

{% endtab %}
{% endtabs %}
