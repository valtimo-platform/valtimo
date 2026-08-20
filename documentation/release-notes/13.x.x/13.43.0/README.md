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

* **Wrapping text in case widgets no longer breaks the layout**

  A field value in a compact field widget now stays right-aligned on every line, and the header row of a table
  widget on the widget tab of a case grows to fit a column header that wraps. Previously the value jumped to the
  left the moment it wrapped, and a wrapping column header was drawn on top of the first row of the table.
