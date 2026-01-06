# Process blueprints

Process blueprints are a collection of files, that either form a starting point to speed up development for an implementation. There are two kinds of blueprints. Process blueprints that directly add value (e.g. a blueprint for City Pass applications), and process blueprints that are a part of the bigger picture (e.g. a process on handling change requests for a case). These can consist of one or more BPMNs, a document definition, forms, as well as less common things such as custom front-end and back-end code. These blueprints can be found on GitHub [here](https://github.com/generiekzaakafhandelcomponent/Basisprocessen).

How to create a process blueprint from an existing project can be found [here](blueprints.md#creating-process-blueprints-for-gzac).

### Prerequisites

This page assumes you have the following knowledge:

* How to add dependencies through Gradle/Maven.
* How to use Git.
* How to create and use Spring beans.
* Java/Kotlin knowledge.

## How to import a process blueprint

Importing a process blueprint and customizing it for a specific use case can be done by following the instructions on this page. Additionally, specific instructions for a blueprint can be found on GitHub for that particular process blueprint. These always take precedent over these general instructions.

### Copying files

This is the general structure of a blueprint:

```
|-- blueprints
|   |-- [name of the blueprint]
|   |   |-- backend
|   |   |   |-- main
|   |   |   |   |-- java
|   |   |   |   |-- kotlin
|   |   |   |   |-- resources
|   |   |   |       |-- bpmn
|   |   |   |       |-- dmn
|   |   |   |       |-- config
|   |   |   |           |-- document
|   |   |   |           |-- form
|   |   |   |           |-- form-flow
|   |   |   |           |-- formlink
|   |   |   |           |-- liquibase
|   |   |   |           |-- process-document-link
|   |   |   |           |-- application.yml
|   |   |   |-- build.gradle/pom.xml
|   |   |-- frontend
|   |   |   |-- app
|   |   |   |-- assets
|   |   |   |-- environments
|   |   |   |-- package.json
|   |   |-- README.md
|   |-- ...
|-- CONTRIBUTING.md
|-- README.md
```

Almost all the files in `backend` can be copied into the back-end of an implementation project. The exceptions are:

* `application.yml`. This only includes the configurations required by the process blueprint. These should be merged with the `application.yml` you already have.
* `build.gradle` or `pom.xml`. This only includes the dependencies required by the process blueprint. These should be merged with the `build.gradle` or `pom.xml` you already have.

Almost all files in `frontend` can be copied into the front-end of an implementation project. The exception is `package.json`. This only includes the dependencies required by the process blueprint. These should be merged with the `package.json` you already have.

### Configuring and customizing the process blueprint

A process blueprint will not work out of the box. Plugins might need to be configured, and process links need to be set. Each process blueprint comes with a README that explains the specifics that should be configured in order for the process blueprint to be used. In addition to this, consider the following checklist:

* Check each task in the BPMN definition. Are all tasks defined correctly?
* If a task relies on a method for a specific spring bean, are both the bean and the method present?
* Does this process blueprint rely on plugins? If so, these will have to be configured, and process links will have to be configured for the appropriate tasks as well.
* Does every user task have a form or form flow associated with it?
* If there are form flows, are all the forms it references present?

As always, be sure to follow the specific instructions that are included with the process blueprint.

## Creating process blueprints for GZAC

It is encouraged to share processes that can potentially be used by other organisations. Another organisation can then implement the same process with minimal effort.

### Privacy and intellectual property

Sharing these processes is done through a public repository. This has some effects that a publisher should know before you continue.

Shared resources should not contain:

* Any privacy- or security-sensitive information like:
  * Names, addresses or other data of real people.
  * Credentials of users or services
* The organisation name in code, labels, etc.
* Licensed code that conflicts with the repository code.

All submitted code will inherit the license of this repository. It is up to the publisher to include a copyright notice that is not in conflict with the license.

### Adding a process blueprint to the git repository

This is a step-by-step guide on how to submit a process blueprint to the git repository.

#### Checkout the latest code

You can find the latest version of the repository [here](https://github.com/generiekzaakafhandelcomponent/Basisprocessen).

After checking out the code, the folder structure should look similar to this:

```
|-- blueprints
|   |-- [name of the blueprint]
|   |   |-- backend
|   |   |   |-- main
|   |   |   |   |-- java
|   |   |   |   |-- kotlin
|   |   |   |   |-- resources
|   |   |   |       |-- bpmn
|   |   |   |       |-- dmn
|   |   |   |       |-- config
|   |   |   |           |-- document
|   |   |   |           |-- form
|   |   |   |           |-- form-flow
|   |   |   |           |-- formlink
|   |   |   |           |-- liquibase
|   |   |   |           |-- process-document-link
|   |   |   |           |-- application.yml
|   |   |   |-- build.gradle/pom.xml
|   |   |-- frontend
|   |   |   |-- app
|   |   |   |-- assets
|   |   |   |-- environments
|   |   |   |-- package.json
|   |   |-- README.md
|   |-- ...
|-- CONTRIBUTING.md
|-- README.md
```

#### Preparing your files

Before copying the files from the source project into the blueprints project, consider the following:

* Create a separate branch in your source project in which the blueprint can be prepared.
* Remove all code that does not adhere to the [Privacy and intellectual property](blueprints.md#privacy-and-intellectual-property) guidelines.
* Are there any references to project specific code (e.g. code that cannot be used by other organisations)?
  * Are there forms that contain organisation specific fields?
  * Are there form flows that rely on project specific code?
  * Are there tasks in your process(es) that rely on project specific code?
* Are there plugins that should be configured to use this process blueprint? Which tasks need to be configured via process links?
* Are there dependencies that are needed (both in front-end and back-end) that are required for this specific process blueprint?
  * Consider setting up Valtimo dependencies in a more generic way(e.g. `implementation "com.ritense.valtimo:contactmoment:${valtimo_version}"`), to make it easier to specify versions for modules that share a version.
* Are there any application specific properties that need to be set (e.g. in `application.yml` for back-end)?
* Please avoid any compile-time-processing dependencies like Lombok. They might not work correctly in other implementations and can often be replaced by code.

If some code cannot be shared, please provide an empty or simplified implementation in the code.

#### Copy your files

1. Create a new folder in the `blueprints` folder of the blueprints project with the name of your process blueprint.
2. Copy all files related to the new blueprint from the source project to the newly created folder.

* Please adhere to the given folder structure.
* Only include files or folders that are specific for this blueprint.

#### Write documentation

In your new blueprint folder, create a README.md file. It should cover the following topics:

* A summary of the process, including a visual representation of it.
* Technical notes
  * Which version of Valtimo has been tested with.
  * Which versions for plugins this was tested with.
* Instructions on how to implement the process blueprint for an implementation project. Consider the following:
  * Where to copy code to.
  * Code/tasks/forms that should be implemented.
  * Plugins that need to be configured.
  * Tasks that need to be configured (e.g. via process links).
  * Reliance on external services (e.g. OpenZaak).
  * How to use the process blueprint.

#### Pull request

Create a pull request according to the contributing page found [here](https://github.com/generiekzaakafhandelcomponent/Basisprocessen/blob/main/CONTRIBUTING.md).
