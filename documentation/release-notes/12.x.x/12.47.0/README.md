# 12.47.0

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* **The IBAN component keeps the entered value when the IBAN is invalid**

  An invalid IBAN was stored as a list instead of text, so the field showed `[object Object]` after the form
  redrew, for example when a row was added to a data grid. The entered text is now kept and the form cannot be
  submitted until the IBAN is valid.
