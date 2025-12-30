# Valtimo/GZAC

The Valtimo product team aims to deliver new functionality to its users quickly. Contributions from outside the core development team are very much appreciated and welcomed.

## Extend the core or build a plugin

Contributing to the Valtimo platform can be done in two primary ways.

* Extending the Valtimo libraries
* Building a verified Valtimo plugin

### Extending the Valtimo libraries

The Valtimo libraries are the core of the platform, designed to be stable, generic, extendable, backward-compatible, and well-documented. When you contribute by extending these libraries, your contributions— whether new features or bug fixes — benefit the entire Valtimo community.

When considering building an extension, it’s important to decide whether your contribution should be a core feature or an optional feature.

* **Core features** are integral to the platform and impact all users. They must align with the Valtimo platform's design principles and maintain its stability.
* **Optional features** offer flexibility, to build features which are not necessarily used by all users. These can be implemented as modules, giving users the choice to include or exclude them, or through feature toggles, which allow users to enable or disable them as needed. This approach ensures that experimental or non-validated features can be added without compromising the platform's stability.

### Building a verified Valtimo plugin

Another way to contribute is by building a Verified Valtimo Plugin. The Valtimo Plugin framework is designed to simplify platform extension without having to deal with the complexity of product development. Plugins are not part of the product but can be added as required.

Plugins are the best way to build specific integrations with external systems, such as ZGW APIs, mail providers, or document generators. Once correctly added, these plugins are seamlessly recognized and utilised within a Valtimo instance. Plugins are particularly suited for features connected to service tasks in BPMN processes, they may not be ideal for other, stand-alone functionalities.

If you create a generic and reusable plugin, you can submit it for evaluation as a Verified Plugin. Verified Plugins undergo a security review and are maintained by Ritense, ensuring they remain reliable and fully integrated with the Valtimo ecosystem. You can also build more specific plugins - for example to connect to custom systems in your organisation. In that case you maintain the plugin yourself.

## Adding features or bug fixes

1. Create an issue in the [GZAC](https://github.com/generiekzaakafhandelcomponent/gzac-issues) issues repository.
2. Tag the Product Owner in the Github issue. A member of the product team will be in touch to discuss the issue and the proposed solution.
   * The Github handle of the Product Owner can be found in the README.md of the issue repositories.
3. Once agreed with the Product Owner, implement the feature/bugfix in the library repository/repositories.
   * Instructions on how to run Valtimo locally can be found in the README.md of the library repositories.
4. Write release notes and documentation for the feature.
5. [Create a pull request (PR)](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). Do not forget to refer to the documentation you have written for this PR. No reviewers are necessary.
   * It is required to fork the repository to implement the changes and create the PR.
6. The Valtimo team will merge the PR after approval.
