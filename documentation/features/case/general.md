# General

On the General tab case specific configurations can be made that have effect on the behaviour of active cases and the processes that support these cases.

The following configurations can be done on this tab:

* Assigning a case handler
* External start form
* Linking an upload process

<figure><img src="../../.gitbook/assets/General tab (1).png" alt=""><figcaption><p>General tab for Draft case version</p></figcaption></figure>

## Assigning a case handler <a href="#automatic-task-assignment" id="automatic-task-assignment"></a>

{% hint style="success" %}
Available since Valtimo `10.7.0`
{% endhint %}

It is possible to have user tasks be automatically assigned to a case assignee making the tasks in a case appear under the case assignee's task list.

#### Functionality <a href="#functionality" id="functionality"></a>

* This feature causes user tasks (existing and new) to be assigned to the current case assignee if there is one assigned.
* Removal of an assignee from the case will also clear the assignee on all assigned user tasks within all processes using the same business key.

{% tabs %}
{% tab title="Via UI" %}
- Upon the (re-)assignment of a case all user tasks from all processes currently using the same business key will have their assignee updated to match the new case assignee.

<figure><img src="../../.gitbook/assets/Screenshot 2025-06-18 at 15.03.52.png" alt="" width="350"><figcaption><p>Case handler in General tab</p></figcaption></figure>
{% endtab %}

{% tab title="Via IDE" %}
See [here](./#via-ide) for information on how to configure your case definition via the IDE.
{% endtab %}
{% endtabs %}

## Automatic task assignment

{% hint style="success" %}
Available since Valtimo `10.7.0`
{% endhint %}

It is possible to have user tasks be automatically assigned to a case assignee making the tasks in a case appear under the case assignee's task list.

### Functionality

* This feature causes user tasks (existing and new) to be assigned to the current case assignee if there is one assigned.
* Upon the (re-)assignment of a case all user tasks from all processes currently using the same business key will have their assignee updated to match the new case assignee.
* Removal of an assignee from the case will also clear the assignee on all assigned user tasks withing all processes using the same business key.

{% tabs %}
{% tab title="Via UI" %}
Automatic task assignment can be enabled when the case is configured to have a case handler. Once the case handler option is selected, the second checkbox can be ticked, which determines if all user tasks in the processes that support the case should automatically be assigned to the case handler.

<figure><img src="../../.gitbook/assets/Screenshot 2025-06-18 at 15.03.52.png" alt="" width="350"><figcaption><p>Case handler in General tab</p></figcaption></figure>
{% endtab %}

{% tab title="Via IDE" %}
See [here](./#via-ide) for information on how to configure your case definition via the IDE.
{% endtab %}
{% endtabs %}

### Limitations

* Only tasks that the user has access to (user has the required role) are assigned to the case assignee.
* Tasks already loaded on a dossier detail page do not automatically show the new assignment. A component reload (switching tabs or reload the page) is required to see the up-to-date assignee in the task modal.

## External Start Form

It is possible to start a case using a form that was already defined. This can be configured in the 'External start form' component.

<figure><img src="../../.gitbook/assets/Screenshot 2025-06-18 at 15.06.43 (1).png" alt="" width="375"><figcaption></figcaption></figure>

## Link Upload Process to Case

{% tabs %}
{% tab title="Via UI" %}
Every time a user uploads a file, a process is triggered to handle the upload. This process can be configured in the 'link Upload Process to Case' component.

<figure><img src="../../.gitbook/assets/Screenshot 2025-06-18 at 15.07.06.png" alt="" width="375"><figcaption><p>Link upload process in General tab</p></figcaption></figure>
{% endtab %}
{% endtabs %}

Valtimo comes with a system process called 'Upload Document'. This process is meant to handle most generic document uploads. The Upload Document process look like this:

<figure><img src="https://docs.valtimo.nl/~gitbook/image?url=https%3A%2F%2F290147654-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FG2PoMeT8OSmMoaW7kF6t%252Fuploads%252Fgit-blob-478e8bbfd792b432e4d096c15f58db0a3a43e8ec%252Fdocument-upload.png%3Falt%3Dmedia&#x26;width=768&#x26;dpr=4&#x26;quality=100&#x26;sign=e20de8ef&#x26;sv=2" alt="" width="375"><figcaption></figcaption></figure>

By default, the Upload Document process does not do anything, so it will not upload anything yet. The process needs to be configured first.

Process links can be used to configure the Upload Document process. The first service task called 'Upload document' can be linked to a Documenten API plugin action called 'Save uploaded document'. Look [here](https://docs.valtimo.nl/features/zgw/zgw-plugins/configure-documenten-api-plugin) for more information.

<figure><img src="https://docs.valtimo.nl/~gitbook/image?url=https%3A%2F%2F290147654-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FG2PoMeT8OSmMoaW7kF6t%252Fuploads%252Fgit-blob-d9e07ccaf4195444c8b61af934eff8babffe0657%252Fsave-uploaded-document.png%3Falt%3Dmedia&#x26;width=768&#x26;dpr=4&#x26;quality=100&#x26;sign=b9b7a41d&#x26;sv=2" alt="" width="375"><figcaption></figcaption></figure>

Configuring the first service task of the Upload Document process is enough to let Valtimo users upload their documents to the Documenten API in Valtimo. But the documents will not be visible yet in case information within Valtimo. This is because the document has not been linked to any zaak.

The second service task in the Upload Document process is called 'Link uploaded document to zaak'. The Zaken API plugin can take care of this action. Look [here](https://docs.valtimo.nl/features/zgw/zgw-plugins/configure-zaken-api-plugin) for more information.

Plugin action: Link uploaded document to zaak

<figure><img src="https://docs.valtimo.nl/~gitbook/image?url=https%3A%2F%2F290147654-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FG2PoMeT8OSmMoaW7kF6t%252Fuploads%252Fgit-blob-5ff02cd8a0d8344fff22418902f480f63e17bd47%252Flink-uploaded-document-to-zaak.png%3Falt%3Dmedia&#x26;width=768&#x26;dpr=4&#x26;quality=100&#x26;sign=a184c46e&#x26;sv=2" alt="" width="375"><figcaption></figcaption></figure>

## Conditional behavior based on version type

Access to the content and editability of this tab depends on the version of the case being viewed.

* Final version:\
  When the case version is final, the tab will be visible but all components are displayed in a read-only state. Additionally, a warning message is shown at the top of the tap with the following message\
  “This case cannot be updated because it is final”.\
  This restriction is implemented to prevent accidental modifications to finalize data.
* When the user is viewing a draft version of the case, all the components within the tab are fully interactive. Users can make edits of all available actions
