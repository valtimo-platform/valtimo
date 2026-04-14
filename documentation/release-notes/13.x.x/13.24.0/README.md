# 13.24.0

{% hint style="info" %}
**Release date 15-04-2026**
{% endhint %}

## New Features

* **Redirect to case detail after form flow completion**

  When a case is created via a form flow, the user is now automatically redirected to the newly created case detail page
  after completing the last step. Previously, the user was returned to the case list without any indication of which case
  was created.

* **Ad-hoc building blocks on a case**

  Case definitions now have an **Actions** tab in case configuration where administrators manage the items that are
  startable from the **Start** button on the case detail page. The tab lists both processes linked to the case definition
  and ad-hoc building blocks, and allows their visibility and ordering to be managed from a single place.

  For more information, see [Building blocks](../../../features/building-blocks/README.md).

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Security

* **Dependencies**

  All frontend dependencies have been locked to specific versions.

## Bugfixes

* When a new version of a building block is created, forms and form flows are also copied over.
