# Contracts between plugins

External plugins can use each other through **contracts**. One plugin *provides* a contract, for example generating a letter or looking up a registration. Another plugin *calls* that contract. Plugins never talk to each other directly: every call goes through Valtimo, and an administrator decides which plugin configuration answers it.

A contract has a name such as `nl.ritense.openplan@1` and one or more **operations**, such as `get` or `report`. An operation is either:

| Mode | Meaning |
|------|---------|
| **Immediate** | The calling plugin waits for the answer. |
| **Long-running** | The call becomes a **contract job**. The providing plugin works on it in the background and sends the result later. Jobs are listed on the [Contract jobs](#contract-jobs) page. |

{% hint style="info" %}
Calling a contract needs no extra permission. Binding it to a plugin configuration is the permission: a plugin can only call contracts it declares, and only on the configuration you bind them to.
{% endhint %}

---

## Binding a contract

When a plugin calls contracts, the **Permissions & plugins** step of [Configure a plugin](configure-a-plugin.md#configuring-a-plugin) starts with **Plugins this plugin calls**. The same step is shown when you add an app or edit a configuration.

{% stepper %}
{% step %}
For each contract, check which operations the plugin calls
{% endstep %}
{% step %}
Under **Choose a plugin configuration**, select the configuration that answers the contract, or choose **Leave unbound**

Only configurations that provide every operation the plugin calls can be chosen. Calls to an unbound contract fail.
{% endstep %}
{% step %}
Review the rest of the step and save
{% endstep %}
{% endstepper %}

The step can show these messages:

| Message | What to do |
|---------|------------|
| **No configuration provides this contract yet.** | Configure the plugin that provides the contract first, then edit this configuration and bind it. |
| **No configuration provides every operation this plugin calls.** | The configurations that provide the contract are missing operations. Ask the supplier which plugin version provides them. |
| **Bound to … which no longer provides this contract.** / **…which does not provide …** | The bound plugin changed. Choose another configuration or leave the contract unbound. |

Below the permissions, **Called contracts** lists the contracts and operations the plugin may call. **Provided contracts** lists what the plugin offers to other plugins. That is not a permission, only information.

---

## A new version calls new contracts

When a new version of a plugin or app calls a contract the previous version did not, the review shows **New contracts**. Accepting binds such a contract automatically only where exactly one configuration provides every operation it calls. Everywhere else it stays unbound until you bind it by editing the configuration.

A plugin version that declares contract schemas Valtimo cannot use is tagged **Invalid contract schema**. You cannot create a configuration for it or accept it in a review until the supplier corrects the plugin.

---

## Contract jobs

{% stepper %}
{% step %}
Expand **Admin** in the left sidebar
{% endstep %}
{% step %}
Under **Integrations**, click **Contract jobs**
{% endstep %}
{% endstepper %}

The page lists long-running requests between plugin configurations. Filter by status or by configuration, and click **Refresh** to reload. Click a row to open the job.

| Status | Meaning |
|--------|---------|
| **Pending** | The job is waiting to be delivered to the providing plugin. |
| **Accepted** | The providing plugin received the job and is working on it. |
| **Completed** / **Failed** / **Expired** | The job is finished. Valtimo is sending the result to the calling plugin. A job expires when its deadline passes. |
| **Delivered** | The calling plugin received the result. |
| **Undeliverable** | Valtimo gave up delivering the result to the calling plugin after the maximum number of attempts, or an administrator stopped the delivery. |

A job can be handled from its detail screen:

| Action | When | Effect |
|--------|------|--------|
| **Cancel job** | The job is still pending or accepted. | The job fails as cancelled and the calling plugin is told. This cannot be undone. |
| **Stop delivery** | The job is finished but the result is not delivered yet. | The calling plugin does not get the result and the job becomes undeliverable. |
| **Deliver again** | The job is undeliverable and has a result. | Delivery to the calling plugin starts again from the first attempt. |

{% hint style="warning" %}
The request and result of a job can contain personal data. They are hidden until you click **Show payloads**, and showing them is recorded in the audit log.
{% endhint %}

Delivered and undeliverable jobs are removed 30 days after their last change, by default.

---

## Deleting a configuration that uses contracts

A plugin configuration cannot be deleted while:

- another configuration is bound to it through a contract;
- it has a contract job, as caller or as provider, whose result is not yet delivered or given up on.

The delete dialog lists these usages. Bind the other configuration to something else or leave its contract unbound, and wait for or cancel the open jobs. See [Deleting configurations and integrations](manage-an-integration.md#deleting-configurations-and-integrations).
