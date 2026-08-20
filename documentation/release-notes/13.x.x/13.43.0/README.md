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

* **A draft environment is now also recognised through the default Spring profile**

  Whether an environment allows drafts was determined by looking only at the active Spring profiles. An
  environment that configured its draft profile through `spring.profiles.default`, without setting an active
  profile, was therefore not seen as a draft environment: creating or changing case definitions and building
  blocks was refused with the message that the environment does not support drafts. The default profiles are
  now taken into account, exactly as Spring itself does when no active profile is set.

* **Searching on a date returns results again**

  Picking a date in a search field, such as **Geboortedatum** under **Achternaam en geboortedatum** in a Beelden
  search, passed the date on in a format the external source did not accept, so the search stayed empty.
* **A case with building blocks can be deleted again**

  **Dossier verwijderen** failed with an error on a case that had one or more building blocks. The case is now
  deleted together with its building blocks.

* **A donut chart widget with many categories now shows its circle**

  A dashboard widget with the donut chart display type showed only its legend and no circle when the data source
  returned many categories, because the legend took up all of the space that was meant for the chart. The legend
  is now limited in height and scrolls when it does not fit, so the circle always keeps its space.
