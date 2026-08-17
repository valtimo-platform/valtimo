# Migration

A case definition changes over time: new versions add fields, change the data model, or adjust
the process. Cases that were already running, however, stay on the version they were started on.
Over time this leaves you with cases spread across many different versions, which makes reporting
and maintenance harder.

**Migration** solves this. With a _migration plan_ you can move existing cases forward — their
data **and** their running process — from an older version to a newer one, in a controlled and
repeatable way.

{% hint style="info" %}
Migration works the same way for **building blocks**. Everything on this page applies to building
block definitions too; you configure it under the building block's version instead of a case's.
{% endhint %}

## When to use migration

* A new version of a case changed the data model and you want existing cases to match it.
* You want all cases on the latest version so reporting runs over one consistent data structure.
* The new version contains fixes and you don't want older cases left behind.

## How it works

A migration plan belongs to the version you want to move cases **into** (the _target_). When you
run it, Valtimo goes through the eligible cases and, for each one:

1. Moves the case onto the target version.
2. Applies the configured **data changes**.
3. Migrates the case's **running process** to the new version.

This happens **per case, all-or-nothing**: a case is either fully migrated or left completely
untouched. If a case can't be migrated it is reported as failed and stays on its old version,
while the rest of the cases continue. This means a run can be safely started again later — cases
that were already migrated are skipped.

## Finding the migration screen

* Go to the `Admin` menu.
* Go to the `Cases` menu and select the case.
* Choose the version you want to migrate cases into.
* Open the `Migration` tab.

Here you see all migration plans for that version, together with their current status and progress.

## Creating a migration plan

Select **New migration plan** to open the plan editor. The editor is split into a few tabs, each
covering one part of the plan:

* **General** — the plan's **title**, its **key** (generated from the title, and editable if you want a
  different one), **when it runs** (its trigger, see below), and **which cases** it applies to. The
  conditions decide which cases this plan touches (for example, only cases with a certain status or a
  certain value in their data — see [Conditions](#conditions)). Cases that don't match are left for
  other plans; leave the conditions empty to apply the plan to all cases.
* **Data migration** — what happens to the case data (see [Source and target](#source-and-target)).
  Each row writes one **target** field from a **source**: copy an existing field's value, set a
  fixed value, or clear it. Each change can optionally be given a type (text, number, yes/no, and so
  on).
* **Process migration** — how the running process moves. For each running process you pick a
  **source process** and a **target process** and map the steps of one onto the other (see
  [Source and target](#source-and-target)). You can optionally set process variables during the
  migration.
* **Add building block** / **Remove building block** — optionally create or dissolve building blocks
  on each migrated case, or nested inside each migrated building block (see
  [Adding and removing building blocks](#adding-and-removing-building-blocks)).
* **JSON editor** — a raw view of the whole plan for advanced users who prefer to read or tweak the
  configuration directly. Everything here is also editable through the guided tabs above.

Everything is configured in the UI and saved with the case definition, so the same plan behaves
identically in every environment (test, acceptance, production).

## Conditions

A condition consists of a **field** (a value on the case, for example its status or a field in its
data), an **operator** and a **value**. A case is migrated only when all conditions hold; a case
whose value cannot be read does not match.

| Operator             | Matches when                                                                                                                          |
|----------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| `==`, `!=`           | The field is (not) equal to the value.                                                                                                |
| `>`, `>=`, `<`, `<=` | The field is greater/smaller than the value. Numbers are compared as numbers, anything else alphabetically.                            |
| `in`                 | The field equals one of several values. Enter the values separated by commas, for example `in-behandeling,wacht-op-klant`.             |
| `contains`           | The field contains the value: one of the entries when the field holds a list, part of the text when it holds a single value.           |
| `exists`             | The field has a value at all. Leave the value empty; enter `false` instead to match only cases where the field is empty or missing.    |

### Combining conditions with groups

Conditions listed one after another must **all** hold. To express an "either / or", select **Add
group**: a group holds when **any of** the conditions inside it hold (OR) or when **all of** them do
(AND) — you choose which per group. A group can contain other groups, so conditions can be combined
to any shape, for example:

> status is `in-behandeling`, **and** either the case is marked urgent **or** (the amount is at least
> 1000 **and** a file number is present)

In the plan JSON that reads:

```json
"conditions": [
  {"path": "case:internalStatus", "operator": "==", "value": "in-behandeling"},
  {
    "anyOf": [
      {"path": "doc:/spoed", "operator": "==", "value": true},
      {
        "allOf": [
          {"path": "doc:/bedrag", "operator": ">=", "value": 1000},
          {"path": "doc:/dossier", "operator": "exists"}
        ]
      }
    ]
  }
]
```

A group must contain at least one condition, and groups may be nested up to ten levels deep.

## Source and target

The words **source** and **target** appear throughout the editor. They always mean the same thing:
the **source** is where something is read _from_, the **target** is where it is written _to_.

At the level of the whole plan, the **target** is fixed and the **source** is yours to choose. The
target is always the version the plan belongs to — that is why you create the plan under the version
you want cases to end up on. The source is the version whose cases the plan migrates, and you pick it
on the **General** tab:

* **The previous version** — the ordinary case, and what the editor pre-fills for a new plan.
* **An older version** — the plan then migrates those cases here in a *single step*, instead of
  needing a plan on every version in between. Useful when the intermediate versions have nothing to
  say about the data or the process.
* **A different case definition** — the plan then migrates the cases of *that* case definition onto
  this one, which is how a case definition that has been renamed or replaced brings its running cases
  along.

A plan only ever touches the cases sitting on exactly the version it names. Cases on any other
version are left to the plans that claim them, so several plans may target the same version from
different sources without interfering.

{% hint style="warning" %}
Migrating cases from a **different** case definition also moves them onto the target's document
definition, which has a different name. Anything keyed on the old document definition name — saved
searches, permissions scoped to it, external integrations — is not rewritten and needs checking.
{% endhint %}

## Adding and removing building blocks

Sometimes a new case version doesn't just reshape data and process — it also changes how the case is
split into **building blocks**. A migration plan can do this too, as part of the same run.

* **Add building block** — creates one or more building blocks on each migrated case. For every
  entry you choose the building block and version to create; a new (empty) building block is filled
  using its own data migration (reading from the case), and the case's process is moved into the new
  building block.
* **Remove building block** — dissolves one or more building blocks on each migrated case. Before a
  building block is removed, its data is transferred back to the case (again via a small data
  migration) and its process is handed back to the case.

Both use the same **source and target** idea as the rest of the editor — the only difference is
which document is being read from and written to, which the editor explains inline for each.

A building block can itself contain building blocks, so a **building block** plan has the same two
sections. There the owner is the migrating building block instead of a case: **Add building block**
creates a block nested inside it and moves one of its processes into that block, and **Remove building
block** dissolves a nested block, handing its data and process back to the block that owned it.

### What "add building block" really does

One sentence explains everything the feature can and cannot do:

> **Adding a building block does not start a new process — it moves a process that is already running
> into the new building block.**

The building block is created empty, filled from the case, and then *takes over* one of the case's
running processes: that process keeps its steps and its position, but from then on it belongs to the
building block. Nothing is started, and nothing is copied.

That is what makes the feature useful for existing cases — a case halfway through its process keeps
its progress while the work moves into a building block — and it is also the source of every
limitation below.

### What it can do

* **Move the case's own process into a building block.** The most common use: the work the case was
  doing becomes work the building block does.
* **Create several building blocks in one plan.** A case can have more than one process running at
  the same time, and each entry takes over one of them, so one plan can produce one building block per
  running process.
* **Move a sub-process into a building block.** If the case's process *calls* another process, an
  entry can take over that called process instead of the main one. The result is a building block that
  behaves exactly like one the case started normally.
* **Fill the new building block from the case.** Each entry has its own data migration, reading from
  the case document and writing into the new building block document.
* **Re-map the process steps on the way in.** Each entry has its own process migration, so the steps
  of the process being taken over can be mapped onto the building block's own process model.
* **Work the same way inside a building block.** On a building block plan, the same section nests a
  new building block inside the migrating one.

### What it cannot do

{% hint style="warning" %}
**It cannot split one process into two.** If the old version does everything in one process and the
new version should have a shorter process that *calls* a building block, adding a building block
cannot produce that. The case's process becomes the building block's process, so there is nothing
left over to do the calling.
{% endhint %}

Fortunately this is rarely a problem, because **most cases don't need it**. If you are carving a
piece of work out of a large process into a building block:

* For cases whose process **has not reached that work yet**, you need no building block section at
  all. Migrate them normally onto the new version; when the process arrives at the point where the
  new version calls the building block, the building block is created there and then, exactly as it
  is for a brand-new case.
* The same is true for cases that are already **past** that work.
* Only cases that are **executing that very work at the moment of migration** are a problem — and the
  way around it is to let the new version keep the old step alongside the new call for a while, so
  those cases can be mapped onto the old step, and drop it in a later version once no case is sitting
  there any more.

The other limits are smaller, but worth knowing:

* **No running process means no building block.** If a case has no running process for the entry to
  take over — a closed case, for example — that entry is skipped and no building block is created.
  The case still migrates and is not reported as failed.
* **The new version must actually use the building block.** A plan can only add a building block
  version that the target case version links, either as a startable item or through a call in one of
  its processes. A plan that adds something the version does not use is refused when you save it, and
  again if it is run. The reason is that such a building block would be created once and then never be
  migrated again by any later plan, because a building block only ever moves when the version owning
  it says which version it should be on.
* **Adding happens before removing.** Within one plan, building blocks are added before any are
  removed, so an entry cannot take over a process that another entry in the *same* plan is about to
  hand back. If you need that, use two plans and chain them with "after another plan".
* **An entry takes over a whole process instance**, not part of one. There is no way to move only some
  steps of a running process into a building block.

## How building blocks follow a case

A building block has no life of its own — it lives inside a case — so a building block plan is never
started by hand. It runs when a case migration moves a building block onto the plan's version, and it
applies to exactly the building blocks that case migration brings with it. A case that never migrates
keeps its building blocks where they are.

Which building block a case's existing block should become is read off the case's **new** version: the
building blocks it offers as startable items and the ones its processes call. If that is a newer
version of the block the case already has, the block is brought up to it. If it is a **different**
building block, the block is carried over to that one instead — which is how one building block
replaces another without abandoning the instances already running.

Getting there needs a **chain of migration plans** leading from the version the block is on to the
version the case links, and the plans' own sources are what form that chain. One plan may cover the
whole jump, or there may be one plan per step — including a step that changes nothing, because every
building block version publishes its own process model and a running block has to be moved onto it
explicitly.

Two situations stop the migration rather than guess, and both fail the whole case (nothing is
half-migrated):

* **Nothing connects them.** No chain of plans leads from where the block is to where the case wants
  it. Add the missing plan.
* **More than one chain connects them.** Which transformations a running block goes through would then
  be arbitrary. Remove or re-source one of the plans so a single chain remains.

Dry-running the *case* migration walks the identical chain, so it reports either problem before a real
run does.

## Managing plans

A version can hold several plans, and each one on the migration screen can be:

* **Edited** — reopen the plan editor to change any part of it.
* **Duplicated** — make a copy as a starting point for a similar plan (the copy is given a
  "copy" suffix so you can rename it).
* **Deleted** — remove a plan you no longer need.

## When a plan runs (triggers)

A plan can be started in one of these ways:

* **Manually** — with the **Start** button on the migration screen. This is the default and the
  safest option.
* **Scheduled** — the plan starts automatically at a chosen moment.
* **After another plan** — the plan starts once another plan has finished. This is also how you
  control ordering: split work into separate plans and chain them.

## Running and monitoring

Start a plan with the **Start** button. The migration screen then shows, per plan:

* the **status** — not started, running, completed, or completed with errors;
* how many cases still need to migrate, how many were migrated, and how many failed;
* a list of the cases that failed, each with the reason — you can expand a case to read the full
  error or copy it, so you can see exactly what went wrong.

Because migration is all-or-nothing per case and already-migrated cases are skipped, you can fix
the cause of any failures and simply run the plan again — only the remaining and failed cases are
processed. Migration runs in the background, so it never blocks the application, and it resumes
safely if the application restarts mid-run.

## Dry run

Before running a plan for real, you can **dry run** it with the **Dry run** button on the migration
screen. A dry run goes through exactly the cases the plan would migrate and simulates migrating each
one — applying the data changes and the process migration — but then **rolls everything back**, so
**nothing is changed**. It changes no case data, moves no process, and leaves no trace, so it is
safe to run against production data.

When it finishes, the plan shows a dry-run report:

* how many cases were **checked**, how many **would migrate**, and how many **would fail**;
* the list of cases that would fail, each with the full reason — the same detail you get for a real
  run's failures.

Use a dry run to validate a plan against real data and fix any problems up front. Because a dry run
persists nothing, it never affects a later real run (an already-migrated case is decided only by
real runs, never by a dry run).

Dry runs work the same way for **building blocks** — use the **Dry run** button on the building
block version's `Migration` tab.

## Good to know

* **Multiple plans per version.** A version can have several plans, each handling a different group
  of cases. Use conditions to target a group, and "after another plan" to order them.
* **Data is validated.** Changed case data is checked against the new version's data model before
  it is saved; if it doesn't fit, that case fails and is left untouched.
* **Process mapping rules.** Mapping process steps follows the process engine's rules — steps are
  mapped to steps of the same type. Structural changes that the engine can't map are reported so
  you can adjust the plan.
