# Configuration

Case specific configurations can be made that have effect on the behaviour of active cases and the processes that support these cases.

Currently there are two options that can be configured on this page.

* Assigning a case handler
* Automatically assigning user tasks to the case handler

## Configuring cases to be assignable

On the case management page, a setting can be changed to indicate that cases of that type can have an assignee. This can be done by toggling the 'Case handler' checkbox to enable assigning cases.

When the case handler option is selected the following changes are visible in the user interface:

*   **The case list screen is divided in to three tabs**\\

    <figure><img src="../../.gitbook/assets/image (35) (1).png" alt=""><figcaption><p>Case overview with case handler option selected<br></p></figcaption></figure>

    * **All cases**\
      _&#x54;his overview is the same as for cases that do not have a case handler configured._\
      _&#x41;ll cases are displayed on this tab._
    * **My cases**\
      _&#x4F;verview of cases that are assigned to the user that is currently logged in._
    * **Unassigned cases**\
      _&#x4F;verview of cases that are not assigned to a case handler_\\
* **An "Assignee" column is automatically added to the case list columns**\
  This column displays the case handler assigned to each case in the overview. This column is fixed and can't be removed via the case list configuration page.\\
* **An option to assign a case handler on the case details page.**\
  When clicked a dropdown menu is displayed with all case handlers that can be assigned to the case. Case handlers can be configured via [Access control](../access-control/README.md) for each case type.\\
* **An additional menu in which a case can be claimed.**\
  In this menu the logged in user has the possibility to immediately "claim" the case. Once a case is claimed, the unassign option removes the case handler that is currently assigned to the case. Who is allowed to claim, assign and unassign is all configured via [Access control](../access-control/README.md).

Case settings can be configured as shown [here](README.md#creating-a-case-definition)

## Assigning a case handler

There are different ways of assigning a user to a case.

* Assigning the case via the UI
* Claiming the case via the UI
* Implementing a service task in the process
* Using an endpoint in the backend of the implementation

#### Assigning a case

On the case details page there is an option to assign a user. When clicked, a dropdown menu opens that displays all case handlers that can be assigned.

<figure><img src="../../.gitbook/assets/image (36) (1).png" alt=""><figcaption><p>Assigning a user</p></figcaption></figure>

#### Claiming a case

When a specific case is opened, it can be claimed with the `Claim` button in the menu on the right side of the case details page.

<figure><img src="../../.gitbook/assets/image (37).png" alt=""><figcaption><p>Menu to claim a case or unassign the current assignee</p></figcaption></figure>

Once a case is assigned the `Unassign` button is enabled, making it possible to unassign the case again.

#### User assignment through the process

It is possible to assign a user to the current process by creating a service task and adding the following expression:

```
${documentDelegateService.setAssignee(execution, "email address of user")}
```

When this service task is reached the assignee will be set.

<figure><img src="../../.gitbook/assets/set-case-assignee.png" alt=""><figcaption><p>Assign user in process</p></figcaption></figure>

Unassigning the case inside a process can be done by using the following expression:

```spel
${documentDelegate.unassign(execution)}
```

## Automatic task assignment

{% hint style="success" %}
Available since Valtimo `10.7.0`
{% endhint %}

It is possible to have user tasks be automatically assigned to a case assignee making the tasks in a case appear under the case assignee's task list.

### Functionality

* This feature causes user tasks (existing and new) to be assigned to the current case assignee if there is one assigned.
* Upon the (re-)assignment of a case all user tasks from all processes currently using the same business key will have their assignee updated to match the new case assignee.
* Removal of an assignee from the case will also clear the assignee on all assigned user tasks withing all processes using the same business key.

Automatic task assignment can be enabled when the case is configured to have a case handler. Once the case handler option is selected, the second checkbox will appear that configures if all user tasks in the processes that support the case should automatically be assigned to the case handler.

<figure><img src="../../.gitbook/assets/image (31) (1).png" alt=""><figcaption><p>Case specific configuration</p></figcaption></figure>

### Limitations

* Only tasks that the user has access to (user has the required role) are assigned to the case assignee.
* Tasks already loaded on a dossier detail page do not automatically show the new assignment. A component reload (switching tabs or reload the page) is required to see the up-to-date assignee in the task modal.
