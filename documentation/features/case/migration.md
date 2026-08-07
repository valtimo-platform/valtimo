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

* **General** — the plan's **title**, **when it runs** (its trigger, see below), and **which cases**
  it applies to. The conditions decide which cases this plan touches (for example, only cases with a
  certain status or a certain value in their data — see [Conditions](#conditions)). Cases that don't
  match are left for other plans; leave the conditions empty to apply the plan to all cases.
* **Data migration** — what happens to the case data (see [Source and target](#source-and-target)).
  Each row writes one **target** field from a **source**: copy an existing field's value, set a
  fixed value, or clear it. Each change can optionally be given a type (text, number, yes/no, and so
  on).
* **Process migration** — how the running process moves. For each running process you pick a
  **source process** and a **target process** and map the steps of one onto the other (see
  [Source and target](#source-and-target)). You can optionally set process variables during the
  migration.
* **Add building block** / **Remove building block** — optionally create or dissolve building blocks
  on each migrated case (see [Adding and removing building blocks](#adding-and-removing-building-blocks)).
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

At the level of the whole plan this is fixed and you don't choose it: a plan always migrates cases
**from the previous version** (the source — the version the cases are currently on) **into the
version the plan belongs to** (the target). That is why you create the plan under the version you
want cases to end up on.

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
