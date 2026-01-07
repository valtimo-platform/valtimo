---
icon: shapes
---

# Choosing the right setup

Valtimo is a flexible framework that can be utilised in different setups. This section provides an overview of the three options available. The decision for a setup will influence the flexibility to extend the product, running- and maintenance costs and staffing requirements for the team.

There are essentially three options for using Valtimo:

1. Building business processes in Valtimo via the User Interface
2. Building business processes in Valtimo via an integrated development environment (IDE)
3. Developing business processes with using Valtimo as Development Framework

#### **Configuring Business Processes in the Product, via the User Interface**&#x20;

Instead of being programmed, processes in Valtimo are configured. Processes with BPMN, decision models in DMN and forms are built using drag-and-drop interfaces. In other cases, configurations are written directly in JSON files, such as roles and permissions. In all these cases, the result is captured in JSON or XML.

If there is a need for business logic, JavaScript and DMN can be used.

The typical roles that perform these tasks are the business process engineer or a technical process consultant. These are individuals with a good understanding of web technologies, experience with scripting or limited programming experience, and the ability to tackle complex challenges.

<figure><img src="../../.gitbook/assets/image (26) (1).png" alt=""><figcaption><p>Using the User Interface for building a business process. </p></figcaption></figure>

If there is a need for extending Valtimo, the plugin framework is available. Developers have the option to use this framework to add functionality to the product, often used for integrations with third party systems.&#x20;

Advantages of this setup:&#x20;

* Most simple and cost effective.&#x20;
* No need for professional, full time developers.&#x20;
* No custom code code, low maintenance costs.&#x20;

And on the downside:&#x20;

* No automated testing.
* No automated deployment.&#x20;
* No hard boundaries between test, acceptance and production.&#x20;
* Less flexibel: only UI available options.&#x20;

#### **Configuring Business Processes via an Integrated Development Environment (IDE)**

Building business processes via the User Interface is the most accessible way to build processes. However, it is also the most limiting: not all functionality available in the product can be configured or modeled via the User Interface. More possibilities are available by working with a development environment—an IDE, Integrated Development Environment.&#x20;

The most important advantages are:

* All configuration files are stored in a versioning system, usually Git. It is precisely documented which changes were made by whom—sometimes necessary for compliance.
* Multiple people can work on building a single business process, and even on a single file. This adds value when building large-scale business processes.
* Working with an IDE is generally faster for experienced business process engineers.
* Automated testing possible.&#x20;
* Works with continuous integration and continuous delivery/deployment frameworks.

#### **Building a Task Application Based on Valtimo as a Development Framework**&#x20;

When Valtimo is used as a development framework, all the advantages and disadvantages mentioned above apply. However, one major advantage is added: the ability to program. This means that unlimited possibilities arise to extend or customize the frontend (user interface) and the backend. Some organisations build a completely custom frontend on the Valtimo backend or develop a domain-specific application based on the standard product.

There are disadvantages:

* The more code, the more complex maintenance is. Upgrading Valtimo becomes more difficult and expensive, while updating is crucial for the platform's security and stability.
* More expertise is required from developers.
* The result is harder to share with others for reuse. A basic process without code can be easily exported and offered to other organisations, but a repository with code is more complex and often specific to a particular use case.

#### **The boundary between use as a product and development framework: compiling**

The primary advantage of utilising Valtimo as a development framework is access to all capabilities Kotlin/Java and Angular offer. These programming languages require compilation, which requires experience with programming, branching, version control, and other related tasks. A CI/CD pipeline must be implemented to build (compile) and deploy the code.

When using Valtimo as a Product, compilation is not necessary: the result of changes is immediately visible. A business process is defined in the form of JSON, XML, and JavaScript. This can be done via the User Interface or through a development environment (IDE). A CI/CD pipeline is recommended but not mandatory. _Note: Deploying processes (packages) via a central repository is expected in the future._
