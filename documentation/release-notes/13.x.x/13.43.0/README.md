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

* **The image widget no longer offers task fields it cannot show**

  The value picker of an image widget offered `task:` fields such as the assignee or the due date, even
  though a widget has no task to read them from. Choosing one produced a widget that failed to render.
  Existing image widgets that use a `task:` field must be changed to use a case or document field.
