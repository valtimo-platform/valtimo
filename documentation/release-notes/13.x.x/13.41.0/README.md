# 13.41.0

{% hint style="info" %}
**Release date xx-xx-2026**
{% endhint %}

## Bugfixes

* **Actions now respect the linked building block version**

  Starting a building block from the actions of a case now always runs the version of that building block
  that is linked to the case. Previously a newer version of the same building block took over: after
  creating a new version and changing its process, starting the action still ran the newer version, which
  led to an error when that version wrote to fields the linked version does not have. Changes to other
  versions of a building block no longer affect the version that is linked.

  A process that belongs to a building block can now only be started for a specific version. Starting one
  by process definition key alone - for example from a custom plugin or a `startProcessByProcessDefinitionKey`
  expression outside of a building block - now reports a clear error instead of silently running whichever
  version happened to be deployed last.
