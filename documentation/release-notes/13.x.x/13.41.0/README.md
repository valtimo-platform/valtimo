# 13.41.0

{% hint style="info" %}
**Release date 12-08-2026**
{% endhint %}

## New Features

* **Exporting and importing a process with its process links**

  A process that is not part of a case can now be exported together with its process links, and
  imported on another environment. Use *Export with process links* in the menu of the process to
  download a package, and upload that package on the target environment. Changes that were built and
  tested on one environment therefore no longer have to be reconnected by hand elsewhere.

  During the import you can point every plugin link in the package at the plugin configuration of
  the target environment, so links keep working on an environment that uses different
  configurations. When the process already exists on the environment, the import asks for
  confirmation before replacing it, just like uploading a single BPMN file does.

  Uploading a single BPMN file keeps working as before.

## Enhancements

* **An exported process describes itself**

  The package of an exported process now contains a manifest, just like an exported case definition or
  building block already did. It names the process, its version, and the plugins its process links
  need, so it is clear what a package contains and what the receiving environment has to offer before
  it is imported.

* **An import summary shows what is still missing**

  After importing, a summary shows which items the process refers to that are not present on this
  environment: forms, form flow definitions, decision tables and called sub-processes. Those items
  are deliberately not part of the package, because they can be shared with other processes, and are
  imported separately. Only references that could be determined are shown.

  When the process refers to a form that does not exist on this environment, the import is refused
  beforehand and the missing form is named, so no half-imported process is left behind.

* **A process that is managed by configuration cannot be overwritten by an import**

  Importing a package for a process that exists on this environment as a system process that may not
  be changed is refused, with an explanation. Such a process can still be exported.

* **Process links from the application configuration are leading**

  Process links that are supplied with the application configuration are now leading: a link that is
  not in that configuration is removed when the application starts. This keeps environments that are
  managed through configuration identical to that configuration.

## Bugfixes

* **The exported file is named after the process**

  Exporting a process definition from the process editor produced a file named `diagram.bpmn`. The
  file is now named after the process, so it is clear which process was exported.

* **Selecting a file to upload a process definition filters on the supported file types again**

  The file dialog offered every file type instead of only the supported ones, and dragging a file
  onto the upload area did nothing. Both work again, for BPMN files as well as exported process
  packages.
