# Actions

Actions are the items that appear under the **Start** button on the case detail page. They let a user start additional
work on a running case — either a [process](processes.md) that is flagged as startable within an existing case, or an
ad-hoc [building block](../building-blocks/README.md).

The **Actions** tab in case configuration is the single place to manage both. From here an administrator can add,
remove, edit, and reorder the actions that end users see in a case.

{% hint style="info" %}
Actions only cover items that are started _within an existing case_. Processes that start a new case are configured on
the [Processes](processes.md) tab.
{% endhint %}

## The Actions tab

* Go to **Admin** → **Cases** and open a case definition.
* Open the **Actions** tab.

The tab lists every configured action with its name and type (**Process** or **Building block**). The order of the list
matches the order in which the actions appear under the **Start** button on the case detail page.

<figure><img src="../../.gitbook/assets/case-actions-tab.png" alt=""><figcaption><p>Actions tab on a case definition</p></figcaption></figure>

### Add an action

* Click **Add an action**.
* Choose **Process** or **Building block**.
* Select the process or building block (and version, for building blocks) from the list.
    * Processes shown here are those already linked to the case definition on the [Processes](processes.md) tab.
    * Building blocks shown here are building block definitions that are not yet linked to the case definition.
* For a building block, continue the wizard to configure:
    * **Plugin configuration mappings** — for each plugin type used by the building block.
    * **Input mapping** — from case document fields to building block document fields.
    * **Output mapping** — from building block document fields back to case document fields.
* Click **Save**.

## How end users see actions

On the case detail page the **Start** button opens a menu that lists all configured actions in the configured order.

* Clicking the **process** action will open the form configured in the process link configured on the process's start
  event.
* Clicking a **building block** action will open the form configured in the process link configured on the main
  process's start event. The instance runs its main process, and the configured output mapping writes results
  back to the case document.

Running and completed building block instances appear in the case's progress overview alongside the case processes.

{% hint style="info" %}
A building block can only be used as an ad-hoc action when its main process has a start form process link on the
`StartEvent`. See [Building blocks — Start form](../building-blocks/README.md#start-form).
{% endhint %}

## Import and export

Actions are part of the case definition and are included in case definition import and export. The export of a case
definition contains:

* The processes that are marked _startable within an existing case_, via the case's process document link file.
* The ad-hoc building block links, via the case's `*.case-building-block-links.json` file. The building block
  definitions referenced by these links are exported alongside the case definition, even when no process in the case
  uses them through a call activity.
* The **order** of the actions on the **Actions** tab, via a dedicated `*.startable-items.json` file (see
  [Auto-deployment](#auto-deployment) below).

On import, the list of actions and their order are restored to what was exported.

## Auto-deployment

All parts of the Actions configuration can also be set via auto-deployment.

### Process actions

Processes are exposed as actions by setting `startableByUser: true` in the case's process document link file — see
[Processes — Linking a process to the case definition](processes.md).

### Building block actions

Ad-hoc building block links are configured in a `*.case-building-block-links.json` file in the case's
`building-block-link/` directory — see
[Building blocks — Linking building blocks to a case](../building-blocks/README.md#linking-building-blocks-to-a-case).

### Order of actions

The order in which actions appear under the **Start** button is configured by a dedicated file in the case's
`startable-item/` directory:

```
config/case/<case-key>/<version>/
└── startable-item/
    └── <name>.startable-items.json
```

The file is an array. The array position determines the order — the first entry appears first under the **Start**
button. Each entry has a `type` (`PROCESS` or `BUILDING_BLOCK`) and a `key`, and for building blocks a `versionTag`:

```json
[
    {
        "type": "PROCESS",
        "key": "change-name"
    },
    {
        "type": "BUILDING_BLOCK",
        "key": "income-check",
        "versionTag": "1.0.0"
    }
]
```

| Field        | Description                                                                                 |
|--------------|---------------------------------------------------------------------------------------------|
| `type`       | `PROCESS` or `BUILDING_BLOCK`.                                                              |
| `key`        | The process definition key, or the building block definition key.                           |
| `versionTag` | Only required for `BUILDING_BLOCK` entries. The version of the building block to reference. |

{% hint style="info" %}
The referenced processes must be linked to the case via the process document link file, and the referenced building
blocks must be linked via the `*.case-building-block-links.json` file. Entries without a matching link are ignored.
{% endhint %}

{% hint style="warning" %}
On import, all existing ordering rows for the case definition are replaced with the contents of this file. An entry
that is omitted will fall back to the default order (last, sorted by name).
{% endhint %}
