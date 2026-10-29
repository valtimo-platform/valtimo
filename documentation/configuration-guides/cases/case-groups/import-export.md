# Import and export

{% hint style="success" %}
Available since Valtimo `13.52.0`
{% endhint %}

A case group can be exported to a ZIP file and imported in another environment, for example to
move a configuration from a test environment to production.

The export contains the complete configuration of the case group:

| Included | Description |
|----------|-------------|
| General | Key, name, description, and color |
| Case definitions | The keys of the case definitions in the group |
| List columns | All columns, including their path per case definition |
| Search fields | All search fields, including their path per case definition |

Cases are not part of the export.

---

## Exporting a case group

{% stepper %}
{% step %}
Go to **Admin** > **Cases** and click the **Case groups** tab
{% endstep %}
{% step %}
Click a case group to open it
{% endstep %}
{% step %}
Click **Export** in the header

<figure><img src="../../../assets/configuration-guides/cases/case-groups/10-group-detail-header.png" alt=""><figcaption>Export button</figcaption></figure>
{% endstep %}
{% endstepper %}

The browser downloads a ZIP file with the configuration of the case group.

---

## Importing a case group

{% stepper %}
{% step %}
Go to **Admin** > **Cases** and click the **Case groups** tab
{% endstep %}
{% step %}
Click **Upload**
{% endstep %}
{% step %}
Click **Select file** and select a ZIP file exported from a case group
{% endstep %}
{% step %}
Read the warning and select **I understand that an existing case group with the same key will be
overwritten**

<figure><img src="../../../assets/configuration-guides/cases/case-groups/11-import-group-modal.png" alt=""><figcaption>Import case group</figcaption></figure>
{% endstep %}
{% step %}
Click **Import**
{% endstep %}
{% endstepper %}

{% hint style="warning" %}
If a case group with the same key already exists, it is overwritten, including its case
definitions, list columns, and search fields.
{% endhint %}

{% hint style="info" %}
Case definitions that do not exist in the target environment are skipped. Import or create these
case definitions first, then import the case group again.
{% endhint %}
