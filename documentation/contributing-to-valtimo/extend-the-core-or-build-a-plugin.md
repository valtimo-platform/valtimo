# Extend the core or build a plugin

Contributing to the Valtimo platform is very much appreciated and can be done in two primary ways: extending the Valtimo Product or building a Verified Valtimo Plugin.

### Extending the Valtimo Libraries <a href="#extending-the-valtimo-libraries" id="extending-the-valtimo-libraries"></a>

The Valtimo libraries are the core of the platform, designed to be stable, generic, extendable, backward-compatible, and well-documented. When you contribute by extending these libraries, your contributions—whether new features or bug fixes — benefiting the entire Valtimo community.

When considering building an extension, it’s important to decide whether your contribution should be a core feature or an optional feature.

* **Core features** are integral to the platform and impact all users. They must align with the Valtimo platform's design principles and maintain its stability.
* **Optional features** offer flexibility, to build features which are not necessarily used by all users. These can be implemented as modules, giving users the choice to include or exclude them, or through feature toggles, which allow users to enable or disable them as needed. This approach ensures that experimental or non-validated features can be added without compromising the platform's stability.

### Verified Valtimo Plugin <a href="#verified-valtimo-plugin" id="verified-valtimo-plugin"></a>

Another way to contribute is by building a Verified Valtimo Plugin. The Valtimo Plugin framework is designed to simplify platform extension without having to deal with the complexity of product development. Plugins are not part of the product but can be added as required.

Plugins are the best way to build specific integrations with external systems, such as ZGW APIs, mail providers, or document generators. Once correctly added, these plugins are seamlessly recognized and utilised within a Valtimo instance. Plugins are particularly suited for features connected to service tasks in BPMN processes, they may not be ideal for other, stand-alone functionalities.

If you create a generic and reusable plugin, you can submit it for evaluation as a Verified Plugin. Verified Plugins undergo a security review and are maintained by Ritense, ensuring they remain reliable and fully integrated with the Valtimo ecosystem. You can also build more specific plugins - for example to connect to custom systems in your organisation. In that case you maintain the plugin yourself.

