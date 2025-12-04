# ℹ️ What is Valtimo

For years, Ritense has worked on building custom process management solutions, solving the same problems with every project. Every project needed a task list, a solution for storing data, an answer to access and entitlement. Valtimo is the result of bundling this knowledge and code into one platform. It is an opinionated Business Process Implementation, based on the accumulated experience from working on BPMN projects for the past years.

## Philosophy

Valtimo does not strive to support a broad tech stack: it is an opinionated Business Process Automation implementation - often following trends in the market.

The core team uses the following guidelines:

1. Use before make. Do not reinvent the wheel.
2. Use microservices with a thin integration layer, making them replaceable in the future.
3. Keep things simple.
4. Use upcoming, but proven technology.

## When to use Valtimo?

There is no universal, broadly accepted definition of Business Process Automation categories. A possible categorization of types is:

1. **Workflow**. Being the simplest form of Business Process Automation, often largely consisting of sequential steps in a predefined process. Examples are the approval flow for holidays requests or onboarding new employees. Using Valtimo for these types of processes is not recommended. Using a point solution is often the better option.
2. **Service Orchestration**. In large scale microservice landscapes, communication between services can be a challenge. To step away from point-to-point connections, communication can be handled with a choreography pattern with a message bus solution like Kafka, AWS SQS or RabbitMQ. The alternative option is to use an orchestration pattern using a BPMN engine. These types of processes are typically seen in enterprise environments, focussing on eliminating manual work. Typically high volume processes with no or minimal manual work. Using Valtimo for service orchestration is not recommended. Using a scalable BPMN engine is advised.
3. **Case Management**. This is a more complex form of Business Process Automation. Typically, the course of a Case is not predictable. Based on events that take place, the handling of the case differs. Typically, there will be a mix of automated tasks and user tasks and often complex and event based processes. Multiple processes can work with one case. Valtimo has been designed for this scenario.
