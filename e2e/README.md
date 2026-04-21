# Valtimo Core E2E

These tests validate the **Valtimo core libraries**, ensuring critical components behave as expected across reusable feature modules. These tests target the platform-level functionality (not implementation-specific instances) and are written using **Playwright** with a focus on:

- Smart, readable assertions
- Isolated, composable test data
- Clear test structure and naming
- Clean setup and teardown

---

## Test Groups & Coverage

| Group | Description |
|-------|-------------|
| `access-control` | User access control and permissions |
| `case-details-config` | Case definition configuration |
| `case-details-management` | Core case detail functionality |
| `case-details-management-case-list` | Case list views within case details |
| `case-details-management-decisions` | Decision tables tab (upload, edit, save DMN) |
| `case-details-management-document` | Document tab (view, edit and save JSON schema) |
| `case-details-management-form-flows` | Form flow integration in case details |
| `case-details-management-forms` | Forms tab — create, build, configure and save forms |
| `case-details-management-header` | Case header widgets and UI |
| `case-details-management-process-links` | Process link wizard (Form / FormFlow / Plugin link types) |
| `case-details-management-processes` | Process management within cases |
| `case-details-management-search-fields` | Search field configuration |
| `case-details-management-tabs` | Case detail tabs configuration |
| `case-details-management-tasks` | Task management in cases |
| `case-details-management-widgets` | Case detail widget-tab configuration |
| `case-management` | Case overview and list management |
| `form-management` | Admin Forms list (independent forms — view, search) |
| `plugins` | Plugin configuration and management |
| `right-sidebar-settings` | Right sidebar settings UI |
| `task-list` | User task list functionality |

For detailed coverage tracking, see [TEST_COVERAGE.md](TEST_COVERAGE.md).

---

## Run the Tests

### Prerequisites

- The application must be running (backend on port 8080, frontend on port 4200, Keycloak on port 8081)
- Create a `.env.properties` file in the `e2e/` directory (see [Environment Variables](#environment-variables))
- Install dependencies: `npm install` from the `e2e/` directory

### Running Tests

```bash
npx playwright test                          # Run all tests (headless)
npx playwright test --headed                 # Run all tests (headed)
npx playwright test <folder>                 # Run tests for a specific domain
npx playwright test --grep "test name"       # Run a specific test by name
npx playwright test --reporter=html          # Run with HTML reporter
```

To run a specific domain with the helper script:

```bash
npx ts-node scripts/e2e-by-folder.ts <folder> [testName]
```

---

## Environment Variables

Create a `.env.properties` file in the `e2e/` directory with the following variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `qa_url` | `http://localhost:4200` | Base URL of the frontend application |
| `qa_admin_username` | `admin` | Admin username for Keycloak |
| `qa_admin_password` | `admin` | Admin password for Keycloak |
| `qa_admin_otp_url` | _(none)_ | OTP URL for MFA-enabled accounts (optional) |
| `qa_timeout` | `30000` | Test timeout (supports moment duration format) |
| `KEYCLOAK_URL` | `http://localhost:8081` | Keycloak base URL |
| `KEYCLOAK_REALM` | `valtimo` | Keycloak realm name |
| `KC_CLIENT_ID` | `valtimo-console` | Keycloak client ID |
| `KC_CLIENT_SECRET` | `secret` | Keycloak client secret |
| `CI` | `false` | Set to `true` in CI environments |
| `headlessMode` | `false` | Run browser in headless mode locally |

---

## Parallelism Considerations

Currently, workers are set to `1` both locally and in CI to ensure stability. While Playwright supports higher parallelism, this suite targets the **Valtimo core platform**, which may experience resource contention under concurrency.

Tests that use Monaco editors, modals, or full-page reloads are typically more fragile under concurrency. Increasing workers may cause page timeouts, unreliable DOM loading, or test flakiness.

---

## Project Structure

```
e2e/
├── api/                  # API endpoint definitions
├── assets/               # Test fixtures (BPMN files, case import archives, decision tables)
├── components/           # Browser-level components (Keycloak login)
├── constants/            # Test ID constants and endpoint definitions
├── scripts/              # Test execution helper scripts
├── shared/               # Shared UI utilities (carbon-list, json-editor)
├── tests/                # Test domains (spec files + page objects)
├── utils/                # Core utilities (API, auth, assertions, data generation)
├── playwright.config.ts  # Playwright configuration
└── TEST_COVERAGE.md      # Test coverage tracking
```

Each test domain in `tests/` follows the Page Object Model pattern:
- `*.spec.ts` — Test specifications
- `page.ts` — Page object with selectors and interactions
- `*-config.ts` — Test data builders (where applicable)

---

## Utility Overview

| Utility | File | Description |
|---------|------|-------------|
| API utils | `utils/api.utils.ts` | Singleton APIRequestContext with bearer token, GET/POST/PUT/DELETE helpers, automatic token refresh on 401 |
| Case utils | `utils/case.utils.ts` | Case management utilities (import case from ZIP archives) |
| Data generator | `utils/dataGenerator.ts` | Generates unique test data IDs and entity names |
| Error utils | `utils/error.utils.ts` | Intercepts API responses and validates status/body |
| Flow | `utils/flow.ts` | Test flow utilities (flow steps, flow definitions) |
| Global setup | `utils/globalSetup.ts` | Bootstraps API bearer token (direct grant) and creates persisted UI `storageState` |
| Monaco utils | `utils/monaco.utils.ts` | Helpers for interacting with Monaco code editors (clear, paste) |
| Retry | `utils/retry.ts` | Generic async retry utility with configurable attempts and delay |
| Settings | `utils/settings.ts` | User settings (e.g., set language) via API |
| Smart assert | `utils/smartAssert.ts` | Structured assertion logging with severity metadata using `test.step()` |
| Smart step | `utils/smartStep.ts` | Standardized step logging for consistent visual traces |
| Teardown | `utils/teardown.ts` | Cleans up auth tokens and disposes API context after tests |
| UI utils | `utils/ui.utils.ts` | Common UI helpers (notifications, buttons, modals) |
| Version utils | `utils/version.utils.ts` | Version dropdown helpers (draft/final selection, URL parsing) |

---

## Testing Guidelines

- When UI functionality testing requires setup, it should preferably be performed through the API.
- When a large amount of data is required for the setup, prefer using import endpoints instead of autodeployment files or manually creating the data.
- Ensure that each test file can run independently, including its own setup and teardown procedures.
- Maintain proper separation of concerns based on functionality.
- Use `data-test-id` attributes for element selection (configured in `playwright.config.ts`).
