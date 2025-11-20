# Case Management – Valtimo Core E2E

This suite covers the **Case Management domain group**, introduced in Valtimo 13. The Case Management group brings together several composable domains—each testable in isolation—and defines declarative **flows** that implementation teams can reuse when needed.

This suite provides the **core scaffolding only**:
- ✅ PageObjects and fixtures per domain
- ✅ DomainGroup fixtures for grouped setup
- ✅ Declarative `flow()` definitions
- ❌ No client tags
- ❌ No flow execution here (that’s for implementation projects)

---

## 💡 Architecture Overview

### Domains
Atomic units of test logic with their own:
- Page object
- Fixtures
- Test data builders

Included domains:
| Domain        | Description                                |
|---------------|--------------------------------------------|
| `caseDefinition` | Base case setup (name, toggles)         |
| `formFlow`       | Form linkage per case                   |
| `statuses`       | Custom case status flows                |
| `tags`           | Case classification tags                |
| `processes`      | Upload and handling process configs     |
| `searchFields`   | Case search/filter configuration        |

### Domain Groups
Logical groupings of domains around use-case areas.
- `caseManagement` → all admin-level setup for cases
- (Planned) `caseRuntime` → runtime interaction with active cases

### Flows
Declarative flow **definitions** only (not run in this suite).
Can be used by other test projects as building blocks.

---

## 🧪 Example Flows (Defined, Not Executed)

These flows exist to show what is possible using the included domain groups.

```ts
flow('Configure case with formflow and upload process', ({ casePage, formFlowPage }) => {
  flowStep('Create new case definition');
  flowStep('Enable case handler and auto-assign');
  flowStep('Link external start form');
  flowStep('Create and attach formFlow');
  flowStep('Link upload process');
  flowStep('Save and verify');
});

Or more dynamically:

flow('Configure basic case type', ({ casePage }) => {
  flowStep('Create new case definition', async () => {
    await casePage.createCaseDefinition('basic-case');
  });

  flowStep('Enable external form', async () => {
    await casePage.configureExternalStartForm('https://external.form', 'External Form');
  });

  flowStep('Save case definition', async () => {
    await casePage.saveGeneralSettings();
  });
});
```

These use flowStep() to provide structured step tracking at the flow level, similar to smartStep() used within domain actions.

⸻

⚙️ Design Principles
	•	No business logic in flows — logic lives in domains
	•	Flows should read like a spec — readable by POs/devs
	•	No client-specific tags or filtering here — flows are reused downstream
	•	Tests in this repo validate only domains + domain groups
Flows are helpers, not assertions

⸻

✅ Testable Layers

Layer	Tests?	Description
formFlow	✅	Unit tests per domain
caseManagement	✅	Validates group logic and interactions
flows/	❌	Flow steps defined, not run here
Implementation	🔜	Will import and run flows with tagging etc.


⸻

🧠 Future-Proof Additions (Planned, Not Implemented Here)
	•	🧱 flow() and flowStep() helpers for declarative test creation
	•	🧰 createFlowTemplate() CLI for consultants/devs to scaffold custom flows
	•	📈 Visual Flow Maps using MermaidJS/D3 for high-level test dashboards
	•	✅ Optional “certified green flows” when composed domains pass core tests

⸻

🧪 Running Tests

This suite tests the domains and groups only. To run those:

pnpm e2eTestPlaywright

Filters are by domain, not by flow or client.

⸻

Utilities Used

Utility	Purpose
smartStep()	Used inside domain methods for structured test traces
flowStep()	(Planned) Used inside flows to describe high-level steps
testData	Centralized data builders for each domain
api.utils	Authenticated API interactions (GET/POST/etc.)
ui/	Common helpers for modals, dropdowns, tab switching
monaco	Monaco editor helpers for editing BPMN/config
fixtures/	Domain and domain-group scoped fixtures


⸻

Contribution Guidelines
	•	✅ Write domain/unit tests inside /domains/
	•	✅ Use smartStep() for all domain-level actions
	•	❌ Do not run or tag flows inside this repo
	•	✅ Add new domain groups under /domainGroups/
	•	✅ Add flow definitions to /flows/, using flowStep() for clarity
	•	🔁 Use testData and api.utils for setup and teardown

⸻

Let’s build a modular, readable, testable, and ultimately composable QA core for Valtimo. 🧱

---

Let me know when you want to start shaping the `flow()` and `flowStep()` helpers into actual code. I can scaffold their base now or wait until you’re integrating flows in client-side projects.
