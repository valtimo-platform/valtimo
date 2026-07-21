# 13.37.0

{% hint style="info" %}
**Release date xx-xx-2026**
{% endhint %}

## New Features

* **Readiness reflects startup completion**

  The application now reports itself as ready only after it has finished starting up — running its database migrations
  and deploying all of its configuration (case definitions, plugins, forms, and so on). In Kubernetes this means a pod
  only starts receiving traffic once it is fully initialised, which removes a startup race that could cause errors right
  after a (re)start. See [Kubernetes health probes](../../../running-valtimo/application-configuration/kubernetes-health-probes.md) for how to enable it.

* **Skip startup migrations and deployments per instance**

  A new setting `valtimo.bootstrap.enabled` (on by default) lets an instance start against an already-prepared database
  without running migrations or deployments again. This is useful when running multiple instances, so only one needs to
  do the startup work.

## Enhancements

* **Maximum number of files on the Documenten API File Upload component**

  The Documenten API File Upload Form.io component (`documenten-api-file`) now has an optional **Maximum number of
  files** property, which sets how many files may be uploaded through the component. Leaving the property empty keeps
  the previous behaviour of no limit.

## Bugfixes

* **Fixed modal size not persisted for form-flow process links on a start event**

* **Wide lists now scroll horizontally instead of being cut off**

  When a list with many columns is wider than the space available, it now scrolls
  horizontally within its container instead of clipping the columns that do not fit. Previously the content that
  overflowed was hidden and could not be reached.

* **Building block mappings can select whole object nodes again**

  When configuring a building block call activity, the input target and output source dropdowns only listed
  individual leaf properties, so a nested object such as `applicantAddress` could no longer be picked as a whole —
  each underlying field (for example `doc:/applicantAddress/city`) had to be mapped separately. Object and array
  container nodes are selectable again, so an entire subtree can be mapped in a single mapping (for example
  `doc:/applicantAddress`) in addition to its individual leaf properties. This restores the behaviour from before
  nested document property support was introduced in 13.33.0. Existing mappings were unaffected at runtime.
