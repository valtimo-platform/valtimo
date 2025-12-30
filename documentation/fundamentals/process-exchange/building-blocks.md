# Building blocks

Building blocks are a collection of files, that can be used to _supplement_ a process or other parts of an implementation. For information on how to get started with blueprints, see [this page](blueprints.md). These can consist of bpmn process definitions, forms, form flows, plugins, custom front-end, and back-end code.\
For example, a plugin that allows sending messages via Slack could be a building block. Building blocks can be found on GitHub [here](https://github.com/generiekzaakafhandelcomponent/Bouwblokken).

How to create a building block from an existing project can be found [here](building-blocks.md#creating-building-blocks).

### Prerequisites

This page assumes you have the following knowledge:

* How to add dependencies through Gradle/Maven.
* How to use Git.
* How to create and use Spring beans.
* Java/Kotlin knowledge.

## How to import a building block

Importing a building block and customizing it for a specific use case can be done by following the instructions on this page. Additionally, specific instructions for a building block can be found on GitHub for that particular building block. These always take precedent over these general instructions.

### Copying files

This is the general structure of a building block:

```
|-- building-blocks
|   |-- [name of the building block]
|   |   |-- backend
|   |   |   |-- main
|   |   |   |   |-- java
|   |   |   |   |-- kotlin
|   |   |   |   |-- resources
|   |   |   |       |-- bpmn
|   |   |   |       |-- dmn
|   |   |   |       |-- config
|   |   |   |           |-- form
|   |   |   |           |-- form-flow
|   |   |   |           |-- liquibase
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

* `application.yml`. This only includes the configurations required by the building block. These should be merged with the `application.yml` you already have.
* `build.gradle` or `pom.xml`. This only includes the dependencies required by the building block. These should be merged with the `build.gradle` or `pom.xml` you already have.

Almost all files in `frontend` can be copied into the front-end of an implementation project. The exception is `package.json`. This only includes the dependencies required by the building block. These should be merged with the `package.json` you already have.

### Configuring and customizing the building block

A building block will not always work out of the box (e.g. plugins need to be configured). Each building block comes with a README that explains the specifics that should be configured in order for the building block to be used. In addition to this, consider the following checklist:

* Does this building block rely on or contain plugins? If so, these will have to be configured.
* Are there dependencies or application properties that have to be configured?
* If there are form flows, are all the forms it references present?

As always, be sure to follow the specific instructions that are included with the building block.

## Creating building blocks

It is encouraged to share building blocks that can potentially be used by other organisations. Another organisation can then use this with minimal effort.

### Privacy and intellectual property

Sharing these building blocks is done through a public repository. This has some effects that a publisher should know before you continue.

Shared resources should not contain:

* Any privacy- or security-sensitive information like:
  * Names, addresses or other data of real people.
  * Credentials of users or services
* The organisation name in code, labels, etc.
* Licensed code that conflicts with the repository code.

All submitted code will inherit the license of this repository. It is up to the publisher to include a copyright notice that is not in conflict with the license.

### Adding a building block to the git repository

This is a step-by-step guide on how to submit a building block to the git repository.

#### Checkout the latest code

You can find the latest version of the repository [here](https://github.com/generiekzaakafhandelcomponent/Bouwblokken).

After checking out the code, the folder structure should look similar to this:

```
|-- building-blocks
|   |-- [name of the building block]
|   |   |-- backend
|   |   |   |-- main
|   |   |   |   |-- java
|   |   |   |   |-- kotlin
|   |   |   |   |-- resources
|   |   |   |       |-- dmn
|   |   |   |       |-- config
|   |   |   |           |-- form
|   |   |   |           |-- form-flow
|   |   |   |           |-- liquibase
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

Before copying the files from the source project into the building blocks project, consider the following:

* Create a separate branch in your source project in which the building block can be prepared.
* Remove all code that does not adhere to the [Privacy and intellectual property](building-blocks.md#privacy-and-intellectual-property) guidelines.
* Are there any references to project specific code (e.g. code that cannot be used by other organisations)?
  * Are there forms that contain organisation specific fields?
  * Are there form flows that rely on project specific code?
* Are there plugins that should be configured to use this building block?
* Are there dependencies that are needed (both in front-end and back-end) that are required for this specific building block?
  * Consider setting up Valtimo dependencies in a more generic way(e.g. `implementation "com.ritense.valtimo:contactmoment:${valtimo_version}"`), to make it easier to specify versions for modules that share a version.
* Are there any application specific properties that need to be set (e.g. in `application.yml` for back-end)?
* Please avoid any compile-time-processing dependencies like Lombok. They might not work correctly in other implementations and can often be replaced by code.

If some code cannot be shared, please provide an empty or simplified implementation in the code.

#### Copy your files

1. Create a new folder in the `building-blocks` folder of the building blocks project with the name of your building block.
2. Copy all files related to the new building block from the source project to the newly created folder.

* Please adhere to the given folder structure.
* Only include files or folders that are specific for this building block.

#### Write documentation

In your new building block folder, create a README.md file. It should cover the following topics:

* A summary of the building block (what it is, and is meant to do).
* Technical notes
  * Which version of Valtimo has been tested with.
  * Which versions for plugins this was tested with.
* Instructions on how to implement the building block for an implementation project. Consider the following:
  * Where to copy code to.
  * Code/tasks/forms that should be implemented.
  * Plugins that need to be configured.
  * Reliance on external services (e.g. OpenZaak).
  * How to use the building block.

#### Pull request

Create a pull request according to the contributing page found [here](https://github.com/generiekzaakafhandelcomponent/Bouwblokken/blob/main/CONTRIBUTING.md).
