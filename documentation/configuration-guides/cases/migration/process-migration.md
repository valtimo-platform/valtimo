# Process migration

A new case version usually publishes a new process model. A case that is halfway through its process
cannot simply be pointed at it: every in-flight step has to be told where it continues. The **Process
migration** tab of a migration plan describes that move.

One plan can hold several instructions. A case may have more than one process running at the same
time, and each instruction moves the instances of one process definition onto another.

---

## Configuring an instruction

{% stepper %}
{% step %}
Open the plan editor and go to the **Process migration** tab
{% endstep %}
{% step %}
Click **Add process migration**
{% endstep %}
{% step %}
Pick the **Source process** — the definition the running instances currently use — and the **Target
process** they move onto
{% endstep %}
{% step %}
Check the **Activity mapping** and correct any activity whose position changed
{% endstep %}
{% endstepper %}

Each instruction is a collapsible card labelled with the move it makes, for example
`verhuizing → verhuizing-v2`. An instruction without a target process cannot be saved.

{% hint style="info" %}
Source and target here name process definitions, not versions of the plan. See
[Source and target](source-and-target.md).
{% endhint %}

---

## Activity mapping

Activities that kept their technical id are mapped automatically, so the mapping only needs a row for
each activity that moved or was renamed. Both the name and the technical id are shown, so activities
sharing a name can be told apart.

Use **Add mapping** to map a **Source activity** onto a **Target activity**. Activities are mapped
onto activities of a compatible type; the editor reports an incompatible pair so it can be corrected
before saving.

{% hint style="warning" %}
An activity that is left unmapped and no longer exists on the target has nowhere to continue. Dry-run
the plan to see which cases this affects before starting it. See
[Running a plan](running-a-plan.md).
{% endhint %}

---

## Setting process variables

**Set process variables** writes process variables on the migrated instance — useful when the new
process expects a variable the old one never set.

{% stepper %}
{% step %}
Expand **Set process variables** on the instruction
{% endstep %}
{% step %}
Click **Add variable** and choose what the value comes from
{% endstep %}
{% endstepper %}

| Source        | Effect                                                        |
|---------------|---------------------------------------------------------------|
| `Path`        | Copies the value found at the given **Source path**           |
| `Value`       | Writes the **Fixed value** entered next to it                 |
| `Null`        | Clears the variable                                           |

The **Target variable** is the process variable to write, written with a `pv:` prefix — `pv:aanvragerNaam`,
or `pv:/config/enabled` for a nested value. A **Target type** converts the value on the way in; leave it
on **Auto** to write it as it comes.

---

## Options

Two checkboxes per instruction control how the engine performs the move:

| Option                        | Effect                                                                                                                                         |
|-------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------|
| Skip custom listeners         | Execution listeners configured on the activities are not called during the migration. Use this when a listener would re-run work the case has already done |
| Skip input/output mappings    | Input and output mappings on the activities are not applied during the migration. Use this when a mapping would overwrite data the case already holds       |

Both are off by default, which runs the migration with listeners and mappings intact.

{% hint style="info" %}
Migrating a process does not update the candidate groups of running instances. A user task that was
open for one role stays open for that role, even if the new process model assigns it to another. Only
newly started processes use the updated candidate group.
{% endhint %}
