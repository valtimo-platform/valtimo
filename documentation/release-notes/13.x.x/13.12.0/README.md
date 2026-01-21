# 13.12.0

{% hint style="info" %}
**Release date 21-01-2026**
{% endhint %}

## Enhancements

* **Clarified Semver requirement for case definition versions**

  The creation modal for case definitions now explicitly states that the version must adhere to Semantic Versioning.

* **Added the possibility to log an error when an Operaton process gets into incident status**

  When you set the Spring property `operaton.incident.alert-log.enabled` to `true`,
  an error will be logged when an Operaton process gets into incident status.
  This can be useful if you want to set up an alert at infrastructure level. More information about this feature can be found in the [incident error logging documentation](../../../features/process/process/incident-error-logging.md).
