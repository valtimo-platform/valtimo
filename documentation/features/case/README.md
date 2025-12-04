# 🗃️ Case

## What is a case?

Case Management is a form of Business Process Automation. A 'Case' is created after an event, often a need from a person, organisation or external system. A case has the goal to fulfil this need, for example to answer the question, to ship the product or handle the complaint. After the result is achieved, the case is closed.

A concrete example is the need for a permit to organize an event. After an application for a permit has been submitted (the trigger is always something that has happened - an event that took place), a case file is created. If everything goes well from the applicant's perspective, this results in 'something': in this case, a permit.

A case is per definition short-lived, whereby the definition of 'short' can be discussed. However: a patient, car or tree are not 'short-lived' and so not a case within the definition of Case Management. To summarize: the case in Valtimo is a business process, with a clearly defined start and end. &#x20;

### Cases and case definitions

To 'teach' Valtimo what it needs to do when it gets a request to execute a business process, models and definitions are used.&#x20;

The definition of a business process is laid down in a _case definition_. Each _case_ is an instance of a _case definition_. A case definition contains everything the system needs to know to execute the business process from start to end. This entails the proces models, definitions of forms for user tasks, decision tables, the definition of the data to be stored, the definition of access rights and so forth.&#x20;

{% hint style="info" %}
In the Valtimo admin-menu, and in the day-to-day talk between developers the term 'case' is used for 'case definition'. This can be confusing, since end users use the same term 'case' for the instance of the case. &#x20;
{% endhint %}

{% hint style="info" %}
When you have a hammer, everything looks like a nail. Make sure to stick to a form of 'short lived'. While the length of 'short' can be debatable, creating everlasting cases is a risk. Bug fixing and fast improvement cycles can become complex when having to deal with long running cases. Since changes to the case definition do not change existing, running cases, case migration can be needed - which is complex, time consuming and error-prone.
{% endhint %}

### Data in a Case

Information provided by the event leading to the creation of the case is often the first data in the case. For example, a name, address and the complaint in case of a complaint process. During the proces of handeling the case, this data is enriched.&#x20;

A definition of the data is made as part of a case definition. In the standard setup, this is a [document definition in JSON](document-definition.md).&#x20;

The location of the data can be in- and outside Valtimo. The document is stored in the Valtimo database and forms the basis of a case. Data can also be stored in external systems - and referenced to. The case is conceptual: it is a reference to information - information can but does not have to be stored in the case.&#x20;

{% hint style="info" %}
The design of the datamodel and JSON document definition(s) are an often underestimated aspect of the quality of the case definition. Be aware that changes to a data model can require migrations from running case instances and can have impact in other parts of the case definition.&#x20;
{% endhint %}

{% hint style="info" %}
The document definition is non-relational. Do not try to convert a relational model into a document definition. Design and build a relational model and connect it via a plugin.&#x20;
{% endhint %}

## Exporting and importing case definitions

A case definition is a collection of configurations and definitions, such as the document definition, process definitions, forms, form flows and process links. These case definitions can be exported as a ZIP archive, so it can be imported via the UI, added to the repository or shared with others.

### Included/excluded in imports/exports

Most configurations and definitions are included in exports and imports. Some related configurations are not imported and exported, as they are not case definition specific.

| Included in the import/export             | Excluded from the import/export |
| ----------------------------------------- | ------------------------------- |
| Case definition settings                  | Access control                  |
| Decision definitions                      | Dashboards                      |
| Document definition                       | Plugin configurations           |
| Form flows                                |                                 |
| Forms (including case summary if present) |                                 |
| List columns                              |                                 |
| Process definitions                       |                                 |
| Process document associations             |                                 |
| Process links                             |                                 |
| Search fields                             |                                 |
| Tabs                                      |                                 |
| Task list columns                         |                                 |
| ZGW Document columns                      |                                 |

### Export <a href="#export" id="export"></a>

* Go to the `Admin` menu
* Go to the `Cases` menu, select the case you want to export
* Click on **More**
* Click on **Export**

<figure><img src="../../.gitbook/assets/image (14) (1).png" alt=""><figcaption><p>Exporting a case definition</p></figcaption></figure>

Exporting a case definition will result in a ZIP archive containing configurations and definitions that make up the case definition. The structure is the same as found in any application that makes use of the auto-deployment offered by Valtimo.

### Import <a href="#import" id="import"></a>

{% hint style="warning" %}
**Importing a case definition will overwrite any existing document definitions, forms, processes, decision tables, etc.**

Before importing case definitions to environments that already have active cases for that same definition, make sure to check which configurations and definitions are [included and excluded in the exports and imports](./#included-excluded-in-imports-exports).

The same level of attention is required with this export/import option as regular CI/CD via a build pipeline.
{% endhint %}

* Go to the `Admin` menu
* Go to the `Cases` menu
* Click on **Upload**, this opens the _Import case definition modal_
* Follow the steps of the wizard to select the file and start the import

<figure><img src="../../.gitbook/assets/image (15) (1).png" alt=""><figcaption><p>Importing a case definition</p></figcaption></figure>

#### Existing case definition

As mentioned in the warning at the top all existing configurations will be overwritten by the configurations in the export. This immediately has effect on newly created cases but can also have effect on existing cases, especially when the document definition and/or process definitions have changed.

#### New case definition

If the case definition does not exist yet, all configuration files will be imported by the export and based on the quality of the export the case could immediately be working after a refresh of the browser.

Please keep in mind that access control and plugin configurations are not part of a case definition export and most likely need to be configured first for the newly imported case and process definitions. For example if a document generator is configured in the proces then the plugin for that generator needs to be configured and an account to make use of the generator is required.

#### Access control configuration

By default Valtimo does not grant access to its case and process components. Via access control in the Admin menu the needed configuration can be done for each role in that implementation.\
Based on the configured access control imported case definitions can immediatly be visible in the UI after import or configuration can be needed first.\
\
If certain cases in the implementation are only available to a specific role then most likely Access Control needs to be configured before the imported case is visible for other roles than `ROLE_ADMIN`.
