# 13.2.1

{% hint style="info" %}
#### Release date 26-09-2025
{% endhint %}

## Bugfixes

* Process links are now migrated correctly when using a MySQL database.
* Process definitions with subprocesses that contain call activities are now migrated properly.
* When creating a draft case definition from an existing one, version tags in the process definitions are now set correctly.
* Migrating a process definition to multiple case definitions now applies the correct version tags.
* Deploying a global process definition will no longer delete previous versions and their deployments.
* Version tags are now properly taken into account when creating a case-specific process from one that is not linked to a case definition.
* Fixed an issue where Keycloak users with duplicate usernames could not be migrated correctly in Valtimo.
* Migrating process definitions with multiple references to the same definition will no longer create duplicates.
* The separator icon in case details is working again.
* Deleting a global process definition will no longer remove related case definition process definitions with the same key.

## Security improvements

**Breaking Change**

* Case endpoints no longer return the case content. This can be changed via the `application.yml` by setting the `valtimo.includeDocumentContentInResponse` property. This is set to false by default, and should be kept to false as much as possible to prevent sending data that does not need to be shared.
