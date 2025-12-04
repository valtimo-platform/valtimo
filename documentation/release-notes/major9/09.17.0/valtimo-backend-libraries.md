# Valtimo backend libraries (9.17.0)

## New Features

The following features were added:

*   **Improved DocumentVariableDelegateImpl**

    The `findValueByJsonPointer` method of the `DocumentVariableDelegateImpl` class now returns a collection of elements instead of throwing an exception when the node is an ArrayNode.
*   **Postgres support**

    Almost all modules within Valtimo now have support for Postgres databases. The exceptions are:

    * `form-flow-valtimo`

    Information on how to use Postgres can be found [here](../../../fundamentals/getting-started/configure-database.md).
*   **Secret keys in plugins are encypted before storing**

    Properties in plugins can now be marked as secret. When configuring the plugin the secrets will be encrypted before being stored.

    This functionality requires an application property `valtimo.plugin.encryption-secret` the value of this property will determine the encryption key. The encryption-secret has to be at least 16 characters long

    More information on plugin secrets can be found [here](../../../features/plugins/plugins/custom-plugin-definition.md#plugin-properties).
*   **Support for Keycloak resource roles**

    In addition to the realm roles, Valtimo can now also include resource roles for a specified client. Add the client name to the configuration under the key `valtimo.keycloak.client` and its roles will be included.

## Bugfixes

The following bugs were fixed:

*   **Changeset errors on Liquibase 4.8.0 and higher**

    `foreignKeyTableName` is required for `foreignKeyConstraintExists` on Liquibase 4.8.0 and higher. Existing changesets did not implement this property.

## Breaking changes

No known breaking changes.

## Deprecations

No new deprecations.

## Known issues

This version has the following known issues:

*   **Multiple form associations on process definition**

    When multiple start forms are associated with a single process definition, the user is unable to start a new case of that specific type.
* **Updating process variables from a form.io submission**\
  Only process variables of type `String` and `Array<String>` are currently supported by the pv. form.io prefix. Any other types will be set to a null value.
*   **New required application property**

    There is a new mandatory application property `valtimo.plugin.encryption-secret`. The encryption-secret has to be at least 16 characters long.
