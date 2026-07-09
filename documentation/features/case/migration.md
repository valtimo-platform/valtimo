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

Select **New migration plan** to open the plan editor. A plan is made up of a few parts:

* **Title** — a recognisable name for the plan.
* **Which cases** — the conditions that decide which cases this plan applies to (for example,
  only cases with a certain status or a certain value in their data). Cases that don't match are
  left for other plans. Leave the conditions empty to apply to all cases.
* **What data changes** — the data migration. You can **copy** a value from one field to another,
  or **set** a fixed value in a field. Each change can optionally be given a type (text, number,
  yes/no, and so on).
* **How the process moves** — the process migration. You map the steps of the old process to the
  steps of the new one, and optionally set process variables during the migration.
* **When it runs** — the trigger (see below).
* **Source and target** — by default a plan migrates cases from the previous version into the
  version the plan belongs to. If needed, you can point the source or target somewhere else. The
  source and target can even be **different kinds**: you can migrate from a **case to a building
  block**, or from a **building block to a case**, as well as case-to-case and
  building-block-to-building-block.

You can build a plan through these guided sections. Everything is configured in the UI and saved
with the case definition, so the same plan behaves identically in every environment (test,
acceptance, production).

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
* a list of the cases that failed, with the reason, so you can see exactly what went wrong.

Because migration is all-or-nothing per case and already-migrated cases are skipped, you can fix
the cause of any failures and simply run the plan again — only the remaining and failed cases are
processed. Migration runs in the background, so it never blocks the application, and it resumes
safely if the application restarts mid-run.

## Good to know

* **Multiple plans per version.** A version can have several plans, each handling a different group
  of cases. Use conditions to target a group, and "after another plan" to order them.
* **Data is validated.** Changed case data is checked against the new version's data model before
  it is saved; if it doesn't fit, that case fails and is left untouched.
* **Process mapping rules.** Mapping process steps follows the process engine's rules — steps are
  mapped to steps of the same type. Structural changes that the engine can't map are reported so
  you can adjust the plan.
