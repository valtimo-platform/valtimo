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

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* **Wide lists now scroll horizontally instead of being cut off**

  When a list with many columns is wider than the space available, it now scrolls
  horizontally within its container instead of clipping the columns that do not fit. Previously the content that
  overflowed was hidden and could not be reached.
