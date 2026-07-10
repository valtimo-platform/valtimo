# 13.37.0

{% hint style="info" %}
**Release date 15-07-2026**
{% endhint %}

## New Features

* **Readiness reflects startup completion**

  The application now reports itself as ready only after it has finished starting up — running its database migrations
  and deploying all of its configuration (case definitions, plugins, forms, and so on). In Kubernetes this means a pod
  only starts receiving traffic once it is fully initialised, which removes a startup race that could cause errors right
  after a (re)start. See [Back-end migration](back-end-migration.md) for how to enable it.

* **Skip startup migrations and deployments per instance**

  A new setting `valtimo.bootstrap.enabled` (on by default) lets an instance start against an already-prepared database
  without running migrations or deployments again. This is useful when running multiple instances, so only one needs to
  do the startup work.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

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
