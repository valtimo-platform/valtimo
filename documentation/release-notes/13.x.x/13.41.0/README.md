# 13.41.0

{% hint style="info" %}
**Release date 12-08-2026**
{% endhint %}

## New Features

* **A migration plan now chooses the version it migrates from**

  Every migration plan declares a **source**: the blueprint version whose instances it migrates onto the
  version the plan belongs to. Previously the source was implied — always the target's immediately
  preceding version, always under the same key — which limited a plan to a single version hop and made a
  key change impossible. Two things follow from making it explicit.

  A plan may now name **any earlier version**, so cases several versions behind can be brought forward in
  one step instead of needing a plan on every version in between. And it may name a **different key**, so
  the cases of a renamed or replaced case definition — and the running instances of a replaced building
  block — can be carried onto their successor. For building blocks this changes how an upgrade chain is
  worked out: it is now read off the deployed plans themselves rather than from each version's
  `basedOnVersionTag`, and a chain may collapse into one plan or cross from one building block to another.
  If nothing connects the two versions, or if more than one chain of plans does, the migration fails and
  says so rather than guessing — a dry run of the case migration reports either problem up front.

  The source is picked on the **General** tab of the plan editor and is pre-filled with the preceding
  version, so the ordinary version bump is unchanged. In a `*.migration.json` it is the required `source`
  field:

  ```json
  {
    "key": "verhuizing-versiesprong",
    "source": {"key": "verhuizing", "versionTag": "1.0.1"}
  }
  ```

  `key` may be omitted to mean "the same key as the target". Note that a plan with no `source` at all no
  longer deploys, and that a version *without* a predecessor can now carry a plan — the **New migration
  plan** button is no longer disabled for it.

  {% hint style="warning" %}
  Migrating instances from a **different** key also moves them onto the target's document definition,
  which has a different name. Anything keyed on the old document definition name — saved searches,
  permissions scoped to it, external integrations — is not rewritten and needs checking.
  {% endhint %}

## Enhancements

* **Building blocks can be added to and removed from a building block during migration**

  A building block can contain other building blocks, and a **building block** migration plan can now
  create or dissolve them. The **Migration** tab of a building block version has gained the same **Add
  building block** and **Remove building block** sections the case plan editor has; the only difference
  is the owner. Adding creates a block nested inside the migrating building block, filled from the
  owning block's document and taking over one of its processes; removing dissolves a nested block after
  handing its data and process back to the block that owned it. As in the case editor, each entry's data
  and process migration is pre-filled for the building block you pick.

  The engine already supported this — the `addBuildingBlock` and `removeBuildingBlock` plan components
  have always applied to whichever instance is migrating — so plans written by hand as
  `*.building-block-migration.json` are unchanged; they are simply configurable in the UI now.

## Bugfixes

* Starting a **new migration plan** for a building block version pre-filled trigger and condition
  fields that a building block plan is not allowed to carry, so saving the suggested plan failed with a
  validation error. These fields are no longer suggested for building block plans.
