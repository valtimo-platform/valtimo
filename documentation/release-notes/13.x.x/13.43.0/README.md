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

* **Document schemas that refer to themselves no longer crash the application**

  A case document schema in which a property refers back to the schema itself could make the server run out of stack
  space while reading it, for example when listing the values that can be used in a mapping or when migrating
  documents. Such schemas are now read up to a maximum nesting depth.
