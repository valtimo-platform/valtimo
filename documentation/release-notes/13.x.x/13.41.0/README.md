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

* **A divider widget without a title no longer shows a dash**

  A divider widget that is configured without a title now stays empty, both in the widget list on the
  widget management page and on the widget tab of a case. Previously a `-` was shown in both places as a
  placeholder for the missing title. In addition, saving a divider without a title on an IKO view no longer
  fails: the back end required a non-blank title for every widget, while a divider does not need one.

* **A divider widget can be duplicated again**

  Duplicating a divider widget opened the divider dialog in edit mode, which left the key empty without a
  way to fill it in, so the *Duplicate* button stayed disabled. The dialog now opens in duplicate mode and
  suggests a new key, based on the title of the divider or — when it has no title — on the key of the
  divider that is being duplicated.
