# 12.45.0

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* **A document is added to a case only once, however many times Save is clicked**

  Clicking Save more than once in the document metadata window attached the same document to the case that many
  times, and the duplicates had to be deleted by hand on the Documents tab. Only the first click is accepted now.

* **A slow Zaken or Objecten API is given time to answer**

  A call to a Zaken or Objecten API that was slow to respond could be given up on after a few seconds, which could
  leave a zaak behind without a case around it. Such a call now waits up to three minutes for an answer.

* **Dashboard widgets set to bar chart show their counts again**

  A widget with several case counts stayed empty when its display option was set to bar chart, while donut and
  meter showed the same counts correctly.
