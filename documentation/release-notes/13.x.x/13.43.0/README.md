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

* **Case inspection shows the case definition key and version**

  The metadata tab of the case inspection page now shows the key and version of the case definition the case was
  created from. Only the name of the document definition was shown before, which made it impossible to tell which
  version of a case definition a case belongs to.

## Bugfixes

* **Searching on a date returns results again**

  Picking a date in a search field, such as **Geboortedatum** under **Achternaam en geboortedatum** in a Beelden
  search, passed the date on in a format the external source did not accept, so the search stayed empty.

* **A case that cannot be found no longer stops a process, an assignment or a note**

  Automatic team assignment is skipped when the case a task belongs to cannot be determined, instead of failing the
  user task. Previously this aborted the whole process, which for instance stopped a verzoek from being turned into
  a zaak. Assigning a case and adding a note no longer fail either when the case behind the document cannot be
  determined; the behandelaar and notitie are simply not synchronised to the Zaken API.
