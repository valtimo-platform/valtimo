# 13.38.0

{% hint style="info" %}
**Release date 22-07-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **Case start menu updates automatically when process availability changes**

  The start menu on the case detail page now keeps its list of startable supporting processes in sync
  automatically as the case progresses. Previously a supporting process that became (un)available due to
  permission (PBAC) changes only appeared or disappeared after a manual page refresh. The menu now re-fetches
  the startable items in response to case updates, so it always reflects the current visibility.

## Bugfixes

* **Tag columns in task lists now display their content correctly**

  A task list column configured with the *Tags* view type now displays its tag content correctly. Previously the
  tag content was not shown properly for tag-type columns in task lists.

* **Version validation error no longer persists in the create case definition modal**

  After entering an invalid version in the *Create case definition* modal, the validation error stayed
  visible when the modal was closed without saving and reopened. The version field and its error are now reset
  along with the rest of the form.

* **Long case definition descriptions no longer fail to save**

  The description in the *Create case definition* modal is now limited to 256 characters. Previously a longer description caused the save to fail with a server error.
  The character limit is also shown in the field's tooltip.
