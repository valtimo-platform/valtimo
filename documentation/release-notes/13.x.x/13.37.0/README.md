# 13.37.0

{% hint style="info" %}
**Release date xx-xx-2026**
{% endhint %}

## Enhancements

* **Select whole object nodes in value path pickers**

  Value path pickers (used for `doc:` document paths in, for example, forms, widgets, plugin actions and building block
  mappings) now also list object nodes, not only their individual leaf properties. This makes it possible to resolve or
  map an entire nested object at once — for example selecting `doc:/applicant` instead of picking
  `doc:/applicant/name` and `doc:/applicant/address/city` separately.

## Bugfixes

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
