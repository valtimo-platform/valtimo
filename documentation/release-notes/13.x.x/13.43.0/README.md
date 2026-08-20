# 13.43.0

{% hint style="info" %}
**Release date 26-08-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* **A case that cannot be found no longer stops a process, an assignment or a note**

  Automatic team assignment is skipped when the case a task belongs to cannot be determined, instead of failing the
  user task. Previously this aborted the whole process, which for instance stopped a verzoek from being turned into
  a zaak. Assigning a case and adding a note no longer fail either when the case behind the document cannot be
  determined; the behandelaar and notitie are simply not synchronised to the Zaken API.
