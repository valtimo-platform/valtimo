# Valtimo's core features

Valtimo brings together several features that work as a unified system. Understanding these core concepts helps you see how the platform fits together.

---

## Cases

A case is the central concept in Valtimo. It represents a piece of work your organisation handles — an application, request, complaint, or any other workflow.

Every case:
- Is started by an event (an incoming order, a submitted form, an API call)
- Contains all related information in one place
- Progresses through defined stages
- Eventually reaches completion

Cases are defined by **case definitions** — blueprints that specify what data a case contains, which processes run on it, and how it appears in the interface.

{% hint style="info" %}
Learn more in [What is a case?](../fundamentals/case.md)
{% endhint %}

---

## Processes

Processes are the workflows that drive cases forward. They define the steps, decisions, and actions that move work from start to finish.

Valtimo uses BPMN (Business Process Model and Notation) — a visual standard for modeling processes. This means:
- Processes are designed visually, not coded
- Business analysts can understand and modify workflows
- The same model that's designed is the one that executes

A case definition can have one or multiple processes. They work together to handle different aspects of the case lifecycle.

{% hint style="info" %}
Learn more in [What is a process?](../fundamentals/process.md)
{% endhint %}

---

## Building blocks

Complex, long-running processes can become difficult to manage. Building blocks solve this by packaging reusable process components.

A building block contains:
- Process models
- Decision models
- Forms
- Related configuration

Teams can create building blocks for common patterns and reuse them across different case definitions. This keeps complex processes maintainable and promotes consistency.

---

## Forms

Forms capture and display case data. When a process reaches a step that needs user input, a form appears for the user to complete.

Forms in Valtimo:
- Are configured visually
- Connect directly to case data
- Support validation and conditional logic
- Can be reused across different processes

{% hint style="info" %}
Learn more in [What is a form?](../fundamentals/form.md)
{% endhint %}

---

## Plugins

Plugins extend Valtimo's capabilities beyond its core features. They're used to add domain-specific functionality or integrate with other systems.

**What plugins can do:**
- Connect to external services (document management, email, notifications)
- Add specialised features for your domain
- Integrate with your organisation's existing systems

Plugins come in two types:
- **Embedded plugins** — Built into Valtimo, offering deep integration
- **External plugins** — Run separately, providing isolation and independent updates

---

## Access control

Valtimo includes a policy-based access control system that determines who can do what. Rather than simple role assignments, policies can include rules and conditions.

This allows fine-grained control over:
- Which cases users can see
- What actions users can take
- Which data is visible or editable

{% hint style="info" %}
Learn more in [Users, roles and permissions](../fundamentals/roles-permissions.md)
{% endhint %}

---

## Dashboard

The dashboard provides insights into operational information — how cases are progressing, where bottlenecks occur, and how the team is performing.

Dashboards help managers and teams:
- Monitor workload and capacity
- Identify delays before they become problems
- Track performance over time

---

## How features work together

These features don't operate in isolation. A typical flow might look like:

1. An event creates a new **case**
2. A **process** starts automatically
3. The process creates tasks and collects data through **forms**
4. **Plugins** handle external integrations along the way
5. **Access control** ensures the right people see the right information
6. The **dashboard** shows progress to managers
7. **Building blocks** provide reusable components throughout

Understanding this connected system helps you design effective solutions in Valtimo.