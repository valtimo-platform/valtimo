# 🏙️ Architectural overview

### Core elements of the open source technology stack

Valtimo is a Java & [Kotlin](https://kotlinlang.org/) based product, with [Angular](https://angular.dev/) for the frontend. The basis of any implementation is a [Spring Boot](https://spring.io/projects/spring-boot) project. For extending the product or adding plugins, developers can use the Kotlin/Java en Angular ecosystem.

[IBM Carbon](https://carbondesignsystem.com/) is the design system used as basis for the UX design. When extending Valtimo, developers can rely on the well maintained and extensive library of components.

[Postgres](https://www.postgresql.org/) is used as the relational database system, and [Formio](https://formio.com/) is the basis for the no-code forms functionality. [Camunda CE](https://github.com/camunda/camunda-bpm-platform) is the process engine for BPMN and DMN support.

### Scope

Valtimo is designed to run in a services oriented landscape. To keep Valtimo lean, tasks outside the domain of business process automation are typically handled outside the Valtimo product. Examples are documenten generation and sending transactional (notification) emails: Valtimo relies on third party components for these tasks. Plugins help to interact with third party components.

### Deployment

Valtimo can be used both as a standalone process automation system or as a Development Framework for building tailored applications.

When using Valtimo as development framework, a traditional CI/CD approach is used. In this scenario, typically the complete application is build on test, acceptance and production, with use of tools like [Jenkins](https://www.jenkins.io/) or simular. When using Valtimo as a standalone product, only the case configurations are deployed in multiple environments, without the need for building the product. Both options have their up- and downsides, discussed further in this documentation.
