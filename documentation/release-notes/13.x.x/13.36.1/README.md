# 13.36.1

{% hint style="info" %}
**Release date 15-07-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* **Draft process start confirmation now shows the correct message**

  The confirmation dialog for starting a draft process or building block now shows a proper start message
  instead of a delete confirmation message.
 
* **Fixed modal size not persisted for form-flow process links on a start event**

* Fixed the modal size not being saved for form-flow process links on a start event. When configuring a form-flow start
  form, the chosen display type and modal size are now persisted and applied when the start form opens, instead of
  reverting to the default medium size.
  
* **Long page titles are now truncated with an ellipsis**

  When a page title is too long to fit in the page header, it is now shown with an ellipsis and the full title
  appears on hover. This keeps the header action buttons visible regardless of how long the title is. This was
  most noticeable on the form builder header with long form names.

## Security

* **Case documents can no longer be downloaded from the wrong case**

  When downloading or previewing a case document, the application now checks that the document actually belongs to the
  case in the request before returning it. Previously this check was only applied when editing or deleting a document,
  so a signed-in user could retrieve a document from another case by referencing it directly. The read and download
  paths now enforce the same check.

* Updated several dependencies to address reported vulnerabilities.
