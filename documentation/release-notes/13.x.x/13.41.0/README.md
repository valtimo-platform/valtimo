# 13.41.0

{% hint style="info" %}
**Release date 12-08-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **Searchable dropdowns on the process migration screen**

  The *Source Definition*, *Source Version*, *Target Definition*, *Target Version* and *Choose Target*
  dropdowns on the *Process migration* screen are now combo boxes, so typing in the field filters the
  available entries. This makes it easier to find a process in an environment with many process
  definitions. Selecting a source definition now also preselects the same definition as target, and
  clearing the source definition clears the source version, target definition and target version as
  well, so no stale selection is left behind.

* **Searchable process dropdown on the Progress tab**

  The process dropdown on the *Progress* tab of a case is now a combo box. Typing in the field filters
  the processes linked to the case, instead of having to scroll through the full list.

## Bugfixes

* **Processes keep their concept status after an import**

  On the *Processen* tab of an imported dossier, every process came back as a normal process, even when it
  was still a concept in the dossier that was exported. Concepts now stay concepts.

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

* **A divider widget without a title no longer shows a dash**

  A divider widget that is configured without a title now stays empty, both in the widget list on the
  widget management page and on the widget tab of a case. Previously a `-` was shown in both places as a
  placeholder for the missing title. In addition, saving a divider without a title on an IKO view no longer
  fails: the back end required a non-blank title for every widget, while a divider does not need one.

* **A divider widget can be duplicated again**

  Fixed an issue where duplicating a divider opened the duplication dialog with an empty, invalid key that 
  could not be edited, leaving the Duplicate button disabled. The dialog now pre-populates the divider key 
  with a unique default value and allows it to be edited before duplicating.

* **Start form of a building block now opens in the panel**

  Starting a building block from the 'Start' menu of a case did nothing when the start form of its
  main process is configured to be shown in a panel. The panel now opens right away. Previously it
  only appeared after first opening the start form of a regular process in the panel.
