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

* **Document schemas that refer to themselves no longer crash the application**

  A case document schema in which a property refers back to the schema itself could make the server run out of stack
  space while reading it, for example when listing the values that can be used in a mapping. Such schemas are now
  read up to a maximum nesting depth.
