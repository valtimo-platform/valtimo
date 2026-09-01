# Upload a plugin

Plugin packages are `.zip` files produced by a plugin developer. Uploading one installs it on a
plugin host, after which the plugin can be [configured](configure-a-plugin.md).

{% hint style="info" %}
Uploads only apply to plugin hosts. Apps serve their own plugin and accept no uploads.
{% endhint %}

---

## Uploading a plugin package

{% stepper %}
{% step %}
Expand **Admin** in the left sidebar and click **Plugins**
{% endstep %}
{% step %}
Click **Upload plugin**
{% endstep %}
{% step %}
Select the plugin host, choose the `.zip` file, and click **Upload**

<figure><img src="../../../assets/configuration-guides/plugins/external-plugins/10-upload-plugin-modal.png" alt=""><figcaption>Upload plugin</figcaption></figure>
{% endstep %}
{% endstepper %}

On success the plugin is installed and can be configured right away. Valtimo records a
fingerprint of the uploaded package: from this moment on, that plugin version means exactly these
bytes.

---

## Possible outcomes

Besides a successful installation, the upload can end in a few deliberate ways:

### The version already exists with identical content

Nothing to do — the exact same package is already installed.

<figure><img src="../../../assets/configuration-guides/plugins/external-plugins/11-upload-identical-info.png" alt=""><figcaption>Identical package already installed</figcaption></figure>

### The version already exists with different content

A plugin version is never replaced silently. The modal opens a review dialog showing the full
list of permissions the new package requests — the same review as during activation — with a
warning that overwriting can change behavior for everything already using this version.
Confirming replaces the package and re-applies the newly reviewed permissions to every existing
configuration of this plugin version.

{% hint style="danger" %}
Overwriting a version changes the running code behind existing configurations, process links, and
case tabs. Prefer publishing a new version number and activating it alongside the old one.
{% endhint %}

### The plugin targets a different Valtimo version

A plugin package can declare which Valtimo versions it supports. If the running environment falls
outside that range, the upload asks for confirmation first. Compatibility is a warning, not a
hard block — a confirmed upload proceeds.

### The host rejects the package

Invalid packages (broken manifest, disallowed contents, oversized files) are refused with the
reason shown in the modal. Package rules are part of the developer documentation in the
`plugin-host/docs/` folder of the Valtimo repository.
