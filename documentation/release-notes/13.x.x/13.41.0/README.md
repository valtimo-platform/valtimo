# 13.41.0

{% hint style="info" %}
**Release date 12-08-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

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

* **A form flow can now be used as the start form of a building block**

  Starting a building block from the actions of a case now opens its form flow start form, and submitting that
  form starts the building block version that is linked to the case. Previously the start form did not open at
  all and the building block could not be started this way, while the same setup with a regular form did work.

* **Start form of a building block now opens in the panel**

  Starting a building block from the 'Start' menu of a case did nothing when the start form of its
  main process is configured to be shown in a panel. The panel now opens right away. Previously it
  only appeared after first opening the start form of a regular process in the panel.
