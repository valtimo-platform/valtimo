# Notificaties API

{% hint style="success" %}
The Notificaties API plugin is a ZGW plugin and can only be used in the GZAC edition.
{% endhint %}

The Notificaties API plugin connects Valtimo to Open Notificaties. Open Notificaties passes on
messages (notificaties) between ZGW systems, for example when a zaak is created. Valtimo only
receives these notificaties when it has a subscription (abonnement) in Open Notificaties.

Each configuration of the plugin sets who creates that abonnement:

| Abonnement registration | Who creates the abonnement | When to use |
|-------------------------|----------------------------|-------------|
| **Automatic** | Valtimo creates and maintains the abonnement itself. | In most environments. This is the default. |
| **Manual** | An administrator creates the abonnement in Open Notificaties. | When all traffic to Valtimo passes through a gateway that checks certificates. Such a gateway blocks the test message that Open Notificaties sends when Valtimo creates the abonnement itself. |

---

## Configuring the Notificaties API plugin

{% stepper %}
{% step %}
Expand **Admin** in the left sidebar and click **Plugins**

<figure><img src="../../assets/configuration-guides/plugins/notificaties-api/01-plugins-page.png" alt=""><figcaption>Plugins page</figcaption></figure>
{% endstep %}
{% step %}
Click **Configure plugin**, select **Notificaties API** and click **Enter data**

<figure><img src="../../assets/configuration-guides/plugins/notificaties-api/02-choose-notificaties-api.png" alt=""><figcaption>Choosing the Notificaties API plugin</figcaption></figure>
{% endstep %}
{% step %}
Fill in the properties and click **Save configuration**
{% endstep %}
{% endstepper %}

To change an existing configuration, click its row on the **Plugins** page.

| Property | Description |
|----------|-------------|
| Configuration name | The name under which the configuration appears elsewhere in Valtimo. |
| Notificaties API URL | The address of Open Notificaties, for example `https://opennotificaties.example.com/api/v1/`. |
| Abonnement registration | **Automatic** or **Manual**, see the table above. Existing configurations use **Automatic**. |
| Callback URL | Only with **Automatic**. The address at which Open Notificaties reaches Valtimo. It ends in `/api/v1/notificatiesapi/callback`. |
| Authentication header | Only with **Automatic**, optional. A secret that Open Notificaties sends along with every notificatie. Leave it empty to let Valtimo choose one. A changed value is passed on to Open Notificaties when you save. |
| Shared secret | Only with **Manual**, required. The secret that you also enter in the abonnement in Open Notificaties. |
| Authentication plugin configuration | The configuration that Valtimo uses to log in to Open Notificaties. |

---

## Registering the abonnement manually

{% hint style="success" %}
Manual abonnement registration is available since Valtimo `13.53.0`
{% endhint %}

### Setting the configuration to Manual

{% stepper %}
{% step %}
Open a new or existing Notificaties API configuration
{% endstep %}
{% step %}
Select **Manual** in **Abonnement registration**

The **Callback URL** field disappears. With **Manual**, the callback URL is only entered in Open
Notificaties.
{% endstep %}
{% step %}
Enter a **Shared secret**

Choose a long, random value. Do not start it with `Bearer `, or Valtimo refuses the notificaties.

<figure><img src="../../assets/configuration-guides/plugins/notificaties-api/03-manual-registration-form.png" alt=""><figcaption>Manual registration with a shared secret</figcaption></figure>
{% endstep %}
{% step %}
Click **Save configuration**
{% endstep %}
{% endstepper %}

### Viewing what the abonnement needs

Open the saved configuration again. Below the properties, Valtimo lists what the abonnement in
Open Notificaties must contain: the callback URL, and the channels (kanalen) with their filters.

<figure><img src="../../assets/configuration-guides/plugins/notificaties-api/04-manual-abonnement-panel.png" alt=""><figcaption>Callback URL and channels with filters</figcaption></figure>

- **Callback URL** — a suggestion, based on the address in your browser. The **?** icon next to it
  marks this. When Open Notificaties reaches Valtimo through another address, such as a gateway,
  use that address instead.
- **Channels** — the channels needed by the processes and plugins that use this configuration,
  such as **Verzoek** and **Portaaltaak**. A channel can appear more than once, each time with
  other filters. When such a process or plugin changes, the list changes too; update the
  abonnement to match.

### Creating the abonnement in Open Notificaties

In the admin of Open Notificaties:

{% stepper %}
{% step %}
Check that every channel in the list exists, and that it allows the filters listed for it.
Open Notificaties refuses an abonnement with filters that its channel does not allow.
{% endstep %}
{% step %}
Create an abonnement with the callback URL
{% endstep %}
{% step %}
Enter the **Shared secret** in the **Auth** field of the abonnement. Leave the authorization type
on **API key**.
{% endstep %}
{% step %}
Add every channel in the list, with exactly the filters shown for it. A line such as
`actie = create` is a filter with key `actie` and value `create`. Add a channel that appears more
than once as a separate entry for each set of filters.
{% endstep %}
{% endstepper %}

### Good to know

{% hint style="warning" %}
**Switching an existing configuration to Manual.** The abonnement that Valtimo created earlier
stays in Open Notificaties, but no longer works. Remove it, or keep it and enter its **Auth**
value as the shared secret.
{% endhint %}

{% hint style="warning" %}
**Duplicate abonnementen.** Valtimo normally removes leftover abonnementen that it created. While a
configuration is set to **Manual**, it skips this, because it cannot tell them apart from the
abonnement you created. Remove duplicates in Open Notificaties yourself.
{% endhint %}

{% hint style="info" %}
**Deleting a Manual configuration** does not remove its abonnement from Open Notificaties. Remove
it there. Once no configuration is set to **Manual**, Valtimo may remove it during its clean-up.
{% endhint %}

{% hint style="info" %}
**Exports.** A plugin configuration export contains the shared secret as readable text. Store
export files accordingly.
{% endhint %}
