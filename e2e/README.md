# Valtimo Core E2E

These tests validates the **Valtimo core libraries**, ensuring critical components behave as expected across reusable feature modules. These tests target the platform-level functionality (not implementation-specific instances) and are written using **Playwright** with a focus on:

- Smart, readable assertions
- Isolated, composable test data
- Clear test structure and naming
- Clean setup and teardown

---

## Test Groups & Coverage

| Group       | Description                          | Spec Types              | Link to Module                                 |
|-------------|--------------------------------------|--------------------------|------------------------------------------------|
| `form-flow` | Tests around flow definition editor  | Create, Edit, Delete, UI validation | [Form Flow README](tests/domains/formFlow/README.md) |

> Additional groups (e.g. `cases`, `dashboard`) will be added here as the suite grows.

---

## Run the Tests

These tests are designed to validate the **Valtimo core libraries**, not implementation-level or instance-specific behavior. It ensures that the core logic, UI flow, and integrations behave correctly across reusable modules.

### Core Scripts

```bash
pnpm e2eTestPlaywright       # Run all E2E tests with Playwright
```
→ Runs all tests


## ⚙️ Environment Variables

Copy and fill out the `.env.properties.template` file in the project root to provide the required settings.

---


## ⚠️ Parallelism Considerations

While Playwright supports high levels of parallelism, this suite targets the **Valtimo core platform**, which may experience resource contention under high concurrency.

**Recommended:**
- Limit to `2-4 workers` locally depending on your machine
- Use `workers: process.env.CI ? 2 : 4` in `playwright.config.ts`
- Enable retries for flaky tests: `retries: process.env.CI ? 2 : 0` in `playwright.config.ts`
- Monitor tests that use Monaco editors, modals, or full-page reloads — these are typically more fragile under concurrency

Going beyond this may cause:
- Page timeouts
- Unreliable DOM loading
- Test flakiness due to environmental bottlenecks

---

## Utility Overview

| Utility         | Description                                                                 |
|-----------------|-----------------------------------------------------------------------------|
| `api.utils`     | Singleton APIRequestContext with bearer token and simple helper methods.    |
| `dataGenerator` | Centralized builder for domain-specific test data and cleanup hooks         |
| `error`         | Utilities to catch and assert backend errors in tests                       |
| `globalSetup`   | Bootstraps the API bearer token (direct grant) and creates the persisted UI `storageState`.         |
| `monaco`        | Helpers for interacting with Monaco code editors (clear, paste, etc.)       |
| `retry`         | (✅ Built-in) Playwright automatic retry configuration for flaky tests       |
| `settings`      | Access shared constants like auth scopes or timeouts                        |
| `smartAssert`   | Structured assertion logging using `test.step()`                            |
| `smartStep`     | Standardized step logging (with emoji) for consistent visual traces         |
| `teardown`      | Cleans up API token and browser contexts after tests                        |
| `ui`            | Common UI helpers (click dropdowns, validate modals, etc.)                  |

---
