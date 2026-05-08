# Playwright Test Coverage Checklist

## Summary

| Category                    | Features | Functions | ✅ Covered | ❌ Not Covered |
|-----------------------------|----------|-----------|------------|----------------|
| User Features (ROLE_USER)   | 5        | 21        | 12         | 9              |
| Admin Features (ROLE_ADMIN) | 15       | 335       | 143        | 189            |
| **Total**                   | **20**   | **356**   | **155**    | **198**        |

**Coverage:** `155 / 356` — `43.5%`

---

## Legend

| Symbol | Meaning               |
|:------:|:----------------------|
|   ✅   | Covered by Playwright |
|   ❌   | Not covered           |
|   ⏳   | In progress           |
| `N/A`  | Not applicable        |

---

## User Features (`ROLE_USER`)

---

### Feature 1 — Dashboard

| #   | Function                        | Test Scenarios                                                 | Coverage | Notes                                           |
|:----|:--------------------------------|:---------------------------------------------------------------|:--------:|:------------------------------------------------|
| 1.1 | Display widget-based dashboard  | Load dashboard with multiple widgets · Display empty dashboard |    ❌    |                                                 |
| 1.2 | Configure widgets per user/role | Add widget to dashboard · Remove widget from dashboard         |    ❌    |                                                 |
| 1.3 | Real-time data updates (SSE)    | Receive SSE update and refresh widget                          |    ❌    |                                                 |

---

### Feature 2 — Cases (User)

| #   | Function                           | Test Scenarios                                        | Coverage | Notes                                           |
|:----|:-----------------------------------|:------------------------------------------------------|:--------:|:------------------------------------------------|
| 2.1 | View cases overview per definition | Display cases overview for specific definition        |    ✅    | user-cases.spec.ts                              |
| 2.2 | View case details (tabs)           | Navigate and view case details with tabs              |    ✅    | user-cases.spec.ts                              |
| 2.3 | Search/filter cases                | Search cases by criteria · Filter cases using filters |    ✅    | user-cases.spec.ts                              |
| 2.4 | View case documents                | Display list of case documents                        |    ✅    | user-cases.spec.ts                              |
| 2.5 | View case progress/status          | View current case progress and status                 |    ✅    | user-cases.spec.ts                              |
| 2.6 | Execute tasks within case          | Execute task from case detail view                    |    ✅    | user-cases.spec.ts                              |

---

### Feature 3 — Tasks

| #   | Function                 | Test Scenarios                                  | Coverage | Notes                                           |
|:----|:-------------------------|:------------------------------------------------|:--------:|:------------------------------------------------|
| 3.1 | View all open tasks      | Display list of all open tasks                  |    ✅    | task-list.spec.ts                               |
| 3.2 | Filter/sort tasks        | Filter tasks by criteria · Sort tasks by column |    ✅    | task-list.spec.ts                               |
| 3.3 | View task details        | Open and view task details                      |    ✅    | task-list.spec.ts                               |
| 3.4 | Claim task               | Claim an unassigned task                        |    ✅    | task-list.spec.ts                               |
| 3.5 | Execute task (fill form) | Fill in task form fields                        |    ✅    | task-list.spec.ts                               |
| 3.6 | Complete task            | Submit and complete task                        |    ✅    | task-list.spec.ts                               |

---

### Feature 4 — Objects

| #   | Function              | Test Scenarios                                            | Coverage | Notes                                           |
|:----|:----------------------|:----------------------------------------------------------|:--------:|:------------------------------------------------|
| 4.1 | View objects per type | Display objects filtered by type                          |    ❌    |                                                 |
| 4.2 | View object details   | Open and view object details                              |    ❌    |                                                 |
| 4.3 | Search/filter objects | Search objects by criteria · Filter objects using filters |    ❌    |                                                 |

---

### Feature 5 — Views / Images (IKO User)

| #   | Function                | Test Scenarios                                | Coverage | Notes                                           |
|:----|:------------------------|:----------------------------------------------|:--------:|:------------------------------------------------|
| 5.1 | Search IKO objects      | Search for IKO objects using search criteria  |    ❌    |                                                 |
| 5.2 | View search results     | Display IKO search results list               |    ❌    |                                                 |
| 5.3 | View IKO object details | Open and view detailed IKO object information |    ❌    |                                                 |

---

## 🔧 Admin Features (`ROLE_ADMIN`)

---

### Feature 6 — Case Definition Management

#### 6A · General

| #   | Function                       | Test Scenarios                                   | Coverage | Notes                                           |
|:----|:-------------------------------|:-------------------------------------------------|:--------:|:------------------------------------------------|
| 6.1 | Link upload process to case    | Link upload process to case definition           |    ✅    | case-details-management.spec.ts                 |
| 6.2 | Set case handler toggle        | Enable/disable case handler                      |    ✅    | case-details-management.spec.ts                 |
| 6.3 | Set auto-assign tasks toggle   | Enable/disable auto-assign tasks to case handler |    ✅    | case-details-management.spec.ts                 |
| 6.4 | Set external start form toggle | Enable/disable external start form               |    ✅    | case-details-management.spec.ts                 |
| 6.5 | Enter external start form URL  | Configure external start form URL                |    ✅    | case-details-management.spec.ts                 |

#### 6B · Processes

| #    | Function                     | Test Scenarios                                                | Coverage | Notes                                           |
|:-----|:-----------------------------|:--------------------------------------------------------------|:--------:|:------------------------------------------------|
| 6.6  | View linked processes        | Display list of linked processes                              |    ✅    | case-details-management-processes.spec.ts       |
| 6.7  | Create new process           | Create new BPMN process                                       |    ✅    | case-details-management-processes.spec.ts       |
| 6.8  | Open process in BPMN modeler | Open process in BPMN editor                                   |    ✅    | case-details-management-processes.spec.ts       |
| 6.9  | Add BPMN elements            | Add BPMN elements via drag-drop                               |    ✅    | case-details-management-processes.spec.ts       |
| 6.10 | Set process properties       | Configure process properties (Starts case, Startable by user) |    ✅    | case-details-management-processes.spec.ts       |
| 6.11 | Save process                 | Save process definition                                       |    ✅    | case-details-management-processes.spec.ts       |

#### 6C · Process Links

| #    | Function                         | Test Scenarios                                   | Coverage | Notes                                           |
|:-----|:---------------------------------|:-------------------------------------------------|:--------:|:------------------------------------------------|
| 6.12 | Create process link              | Create process link via wizard                   |    ✅    | case-details-management-process-links.spec.ts   |
| 6.13 | Configure Form link type         | Configure Form link type                         |    ✅    | case-details-management-process-links.spec.ts   |
| 6.14 | Configure FormFlow link type     | Configure FormFlow link type                     |    ⏳    | case-details-management-process-links.spec.ts (step visible; no seeded case-scoped flow) |
| 6.15 | Configure Plugin link type       | Configure Plugin link type                       |    ✅    | case-details-management-process-links.spec.ts   |
| 6.16 | Configure plugin action          | Configure plugin action                          |    ✅    | case-details-management-process-links.spec.ts   |
| 6.17 | Configure Building block link    | Configure Building block link type               |    ✅    | case-details-management-process-links.spec.ts   |
| 6.18 | Select building block            | Select building block from available list        |    ✅    | case-details-management-process-links.spec.ts   |
| 6.19 | View building block descriptions | View building block descriptions with artwork    |    ✅    | case-details-management-process-links.spec.ts   |
| 6.20 | Select building block version    | Select building block version                    |    ✅    | case-details-management-process-links.spec.ts   |
| 6.21 | Configure plugin mapping         | Configure plugin mapping for building block      |    ✅    | case-details-management-process-links.spec.ts   |
| 6.22 | Configure input mapping          | Configure input mapping (building block → case)  |    ✅    | case-details-management-process-links.spec.ts   |
| 6.23 | Add input field mapping          | Add input field mapping                          |    ✅    | case-details-management-process-links.spec.ts   |
| 6.24 | Select source path               | Select source path from building block document  |    ✅    | case-details-management-process-links.spec.ts   |
| 6.25 | Map to target case field         | Map to target case field via dropdown            |    ✅    | case-details-management-process-links.spec.ts   |
| 6.26 | Toggle mapping input mode        | Toggle between dropdown/manual input for mapping |    ✅    | case-details-management-process-links.spec.ts   |
| 6.27 | Mark fields as required          | Mark input fields as required                    |    ✅    | case-details-management-process-links.spec.ts   |
| 6.28 | Configure sync mapping           | Configure sync mapping (case → building block)   |    ✅    | case-details-management-process-links.spec.ts   |
| 6.29 | Add sync field mapping           | Add sync field mapping                           |    ✅    | case-details-management-process-links.spec.ts   |
| 6.30 | Select source field from case    | Select source field from case                    |    ✅    | case-details-management-process-links.spec.ts   |
| 6.31 | Map to building block field      | Map to target building block field               |    ✅    | case-details-management-process-links.spec.ts   |
| 6.32 | Delete mappings                  | Delete input/sync mappings                       |    ✅    | case-details-management-process-links.spec.ts   |
| 6.33 | View dependency warnings         | View dependency warnings (push config needed)    |    ✅    | case-details-management-process-links.spec.ts   |
| 6.34 | Complete building block config   | Complete building block configuration            |    ✅    | case-details-management-process-links.spec.ts   |
| 6.35 | Save process link                | Save process link configuration                  |    ✅    | case-details-management-process-links.spec.ts   |

#### 6D · Version Management

| #    | Function          | Test Scenarios               | Coverage | Notes                                           |
|:-----|:------------------|:-----------------------------|:--------:|:------------------------------------------------|
| 6.36 | Select version    | Select version from dropdown |    ✅    | case-details-management.spec.ts                 |
| 6.37 | View all versions | View all versions            |    ✅    | case-details-management.spec.ts                 |
| 6.38 | Manage version    | Manage version               |    ✅    | case-details-management.spec.ts                 |

#### 6E · Decision Tables

| #    | Function                    | Test Scenarios                         | Coverage | Notes                                           |
|:-----|:----------------------------|:---------------------------------------|:--------:|:------------------------------------------------|
| 6.39 | View linked decision tables | Display list of linked decision tables |    ✅    | case-details-management-decisions.spec.ts       |
| 6.40 | Upload decision table       | Upload decision table (.dmn file)      |    ✅    | case-details-management-decisions.spec.ts       |
| 6.41 | Open decision table editor  | Open decision table in DMN editor      |    ✅    | case-details-management-decisions.spec.ts       |
| 6.42 | Set DMN Hit policy          | Set DMN Hit policy                     |    ✅    | case-details-management-decisions.spec.ts       |
| 6.43 | Manage DMN columns          | Manage DMN input/output columns        |    ✅    | case-details-management-decisions.spec.ts       |
| 6.44 | Manage DMN rules            | Add/edit/delete DMN rules              |    ✅    | case-details-management-decisions.spec.ts       |
| 6.45 | Save decision table         | Save decision table                    |    ✅    | case-details-management-decisions.spec.ts       |

#### 6F · Document

| #    | Function             | Test Scenarios              | Coverage | Notes                                           |
|:-----|:---------------------|:----------------------------|:--------:|:------------------------------------------------|
| 6.46 | View JSON Schema     | View JSON Schema definition |    ✅    | case-details-management-document.spec.ts        |
| 6.47 | Download JSON Schema | Download JSON Schema        |    ✅    | case-details-management-document.spec.ts        |
| 6.48 | Edit JSON Schema     | Edit JSON Schema            |    ✅    | case-details-management-document.spec.ts        |
| 6.49 | Save JSON Schema     | Save JSON Schema changes    |    ✅    | case-details-management-document.spec.ts        |

#### 6G · Forms

| #    | Function            | Test Scenarios                                   | Coverage | Notes                                           |
|:-----|:--------------------|:-------------------------------------------------|:--------:|:------------------------------------------------|
| 6.50 | View forms list     | Display list of forms                            |    ✅    | form-management.spec.ts                         |
| 6.51 | Search/filter forms | Search and filter forms                          |    ✅    | form-management.spec.ts                         |
| 6.52 | Create form         | Create new form                                  |    ✅    | case-details-management-forms.spec.ts           |
| 6.53 | Add form components | Form.io builder — add components via drag-drop   |    ✅    | case-details-management-forms.spec.ts           |
| 6.54 | Configure component | Form.io builder — configure component properties |    ✅    | case-details-management-forms.spec.ts           |
| 6.55 | Use JSON editor     | Use Form.io JSON editor                          |    ✅    | case-details-management-forms.spec.ts           |
| 6.56 | View form preview   | View form preview                                |    ✅    | case-details-management-forms.spec.ts           |
| 6.57 | Save form           | Save form definition                             |    ✅    | case-details-management-forms.spec.ts           |

#### 6H · Form Flows

| #    | Function             | Test Scenarios                 | Coverage | Notes                                           |
|:-----|:---------------------|:-------------------------------|:--------:|:------------------------------------------------|
| 6.58 | View form flows list | Display list of form flows     |    ✅    | case-details-management-form-flows.spec.ts      |
| 6.59 | Create form flow     | Create new form flow           |    ✅    | case-details-management-form-flows.spec.ts      |
| 6.60 | Edit form flow JSON  | Edit form flow JSON definition |    ✅    | case-details-management-form-flows.spec.ts      |
| 6.61 | Save form flow       | Save form flow, invalid JSON   |    ✅    | case-details-management-form-flows.spec.ts      |

#### 6I · Tasks

| #    | Function                    | Test Scenarios                       | Coverage | Notes                                           |
|:-----|:----------------------------|:-------------------------------------|:--------:|:------------------------------------------------|
| 6.62 | View task list columns      | View task list columns configuration |    ✅    | case-details-management-tasks.spec.ts           |
| 6.63 | Add task list column        | Add column to task list              |    ✅    | case-details-management-tasks.spec.ts           |
| 6.64 | Rearrange task list columns | Rearrange task list columns          |    ✅    | case-details-management-tasks.spec.ts           |
| 6.65 | View task search fields     | View task list search fields         |    ✅    | case-details-management-tasks.spec.ts           |
| 6.66 | Add task search field       | Add task list search field           |    ✅    | case-details-management-tasks.spec.ts           |
| 6.67 | Toggle JSON/table view      | Toggle task list JSON/table view     |    ❌    |                                                 |

#### 6J · Case List

| #    | Function                    | Test Scenarios                       | Coverage | Notes                                           |
|:-----|:----------------------------|:-------------------------------------|:--------:|:------------------------------------------------|
| 6.68 | View case list columns      | View case list columns configuration |    ✅    | case-details-management-case-list.spec.ts       |
| 6.69 | Add case list column        | Add column to case list              |    ✅    | case-details-management-case-list.spec.ts       |
| 6.70 | Rearrange case list columns | Rearrange case list columns          |    ✅    | case-details-management-case-list.spec.ts       |
| 6.71 | View case search fields     | View case list search fields         |    ✅    | case-details-management-search-fields.spec.ts   |
| 6.72 | Add case search field       | Add case list search field           |    ✅    | case-details-management-search-fields.spec.ts   |
| 6.73 | Download case list config   | Download case list configuration     |    ✅    | case-details-management-case-list.spec.ts       |

#### 6K · Case Details — Tabs

| #    | Function       | Test Scenarios                                 | Coverage | Notes                                           |
|:-----|:---------------|:-----------------------------------------------|:--------:|:------------------------------------------------|
| 6.74 | View tabs      | View tabs configuration                        |    ✅    | case-details-management-tabs.spec.ts            |
| 6.75 | Add tab        | Add tab (Standard / FormIO / Custom / Widgets) |    ✅    | case-details-management-tabs.spec.ts            |
| 6.76 | Rearrange tabs | Rearrange tabs order                           |    ✅    | case-details-management-tabs.spec.ts            |

#### 6L · Case Details — Statuses

| #    | Function              | Test Scenarios              | Coverage | Notes                                           |
|:-----|:----------------------|:----------------------------|:--------:|:------------------------------------------------|
| 6.77 | View statuses         | View statuses configuration |    ✅    | case-details-config.spec.ts                     |
| 6.78 | Add status            | Add new status              |    ✅    | case-details-config.spec.ts                     |
| 6.79 | Set status color      | Set status color            |    ✅    | case-details-config.spec.ts                     |
| 6.80 | Set status visibility | Set status visibility       |    ✅    | case-details-config.spec.ts                     |
| 6.81 | Rearrange statuses    | Rearrange statuses order    |    ✅    | case-details-config.spec.ts                     |

#### 6M · Case Details — Tags

| #    | Function      | Test Scenarios          | Coverage | Notes                                           |
|:-----|:--------------|:------------------------|:--------:|:------------------------------------------------|
| 6.82 | View tags     | View tags configuration |    ✅    | case-details-config.spec.ts                     |
| 6.83 | Add tag       | Add new tag             |    ✅    | case-details-config.spec.ts                     |
| 6.84 | Set tag color | Set tag color, change color |    ✅    | case-details-config.spec.ts                     |

#### 6N · Case Details — Header

| #    | Function            | Test Scenarios                    | Coverage | Notes                                           |
|:-----|:--------------------|:----------------------------------|:--------:|:------------------------------------------------|
| 6.85 | View header widgets | View header widgets configuration |    ✅    | case-details-management-header.spec.ts          |
| 6.86 | Add header widget   | Add header widget                 |    ✅    | case-details-management-header.spec.ts          |

#### 6O · Case Details — Widgets

| #    | Function                 | Test Scenarios                                                            | Coverage | Notes                                           |
|:-----|:-------------------------|:--------------------------------------------------------------------------|:--------:|:------------------------------------------------|
| 6.87 | View widgets list        | View widgets list                                                         |    ✅    | case-details-management-widgets.spec.ts         |
| 6.88 | Add widget               | Add widget via 6-step wizard                                              |    ✅    | case-details-management-widgets.spec.ts         |
| 6.89 | Select widget type       | Select widget type (Fields / Custom / Form.io / Table / Collection / Map) |    ✅    | case-details-management-widgets.spec.ts         |
| 6.90 | Set widget width         | Set widget width                                                          |    ✅    | case-details-management-widgets.spec.ts         |
| 6.91 | Set widget density       | Set widget density                                                        |    ✅    | case-details-management-widgets.spec.ts         |
| 6.92 | Set widget style         | Set widget style                                                          |    ✅    | case-details-management-widgets.spec.ts         |
| 6.93 | Configure widget content | Configure widget content                                                  |    ✅    | case-details-management-widgets.spec.ts         |
| 6.94 | Set widget conditions    | Set widget display conditions                                             |    ❌    |                                                 |
| 6.95 | Add widget separator     | Add widget separator                                                      |    ✅    | case-details-management-widgets.spec.ts         |
| 6.96 | Rearrange widgets        | Rearrange widgets order                                                   |    ✅    | case-details-management-widgets.spec.ts         |
| 6.97 | Use widget JSON editor   | Use widget JSON editor                                                    |    ✅    | case-details-management-widgets.spec.ts         |

#### 6P · ZGW — General

| #     | Function            | Test Scenarios                         | Coverage | Notes                                           |
|:------|:--------------------|:---------------------------------------|:--------:|:------------------------------------------------|
| 6.98  | Configure case sync | Configure case details synchronization |    ✅    | case-details-management-zgw-general.spec.ts     |
| 6.99  | Link case type      | Link case type                         |    ✅    | case-details-management-zgw-general.spec.ts     |
| 6.100 | Edit case type      | Edit case type                         |    ✅    | case-details-management-zgw-general.spec.ts     |
| 6.101 | Delete case type    | Delete case type                       |    ✅    | case-details-management-zgw-general.spec.ts     |

#### 6Q · ZGW — Document Columns

| #     | Function              | Test Scenarios               | Coverage | Notes                                           |
|:------|:----------------------|:-----------------------------|:--------:|:------------------------------------------------|
| 6.102 | View document columns | View document columns        |    ✅    | case-details-management-zgw.spec.ts             |
| 6.103 | Add document column   | Add document column          |    ✅    | case-details-management-zgw.spec.ts             |
| 6.104 | Set column sorting    | Set document column sorting  |    ✅    | case-details-management-zgw.spec.ts             |
| 6.105 | Rearrange doc columns | Rearrange document columns   |    ✅    | case-details-management-zgw.spec.ts             |

#### 6R · ZGW — Upload Fields

| #     | Function                | Test Scenarios                 | Coverage | Notes                                           |
|:------|:------------------------|:-------------------------------|:--------:|:------------------------------------------------|
| 6.106 | View upload fields      | View upload fields             |    ✅    | case-details-management-zgw.spec.ts             |
| 6.107 | Set field visibility    | Set upload field visibility    |    ✅    | case-details-management-zgw.spec.ts             |
| 6.108 | Set field default value | Set upload field default value |    ✅    | case-details-management-zgw.spec.ts             |

#### 6S · ZGW — Keywords

| #     | Function        | Test Scenarios  | Coverage | Notes                                           |
|:------|:----------------|:----------------|:--------:|:------------------------------------------------|
| 6.109 | View keywords   | View keywords   |    ✅    | case-details-management-zgw-keywords.spec.ts    |
| 6.110 | Add keyword     | Add keyword     |    ✅    | case-details-management-zgw-keywords.spec.ts    |
| 6.111 | Search keywords | Search keywords |    ✅    | case-details-management-zgw-keywords.spec.ts    |

---

### Feature 7 — Process Management

| #   | Function                | Test Scenarios                | Coverage | Notes                                           |
|:----|:------------------------|:------------------------------|:--------:|:------------------------------------------------|
| 7.1 | View process overview   | Display process overview list |    ❌    |                                                 |
| 7.2 | Create new process      | Create new BPMN process       |    ❌    |                                                 |
| 7.3 | Edit BPMN process       | Edit existing BPMN process    |    ❌    |                                                 |
| 7.4 | Deploy process          | Deploy process definition     |    ❌    |                                                 |
| 7.5 | Manage process versions | Manage process versions       |    ❌    |                                                 |

---

### Feature 8 — Decision Table Management

| #   | Function                      | Test Scenarios                        | Coverage | Notes                                           |
|:----|:------------------------------|:--------------------------------------|:--------:|:------------------------------------------------|
| 8.1 | View decision tables overview | Display decision tables overview list |    ❌    |                                                 |
| 8.2 | Create decision table         | Create new decision table             |    ❌    |                                                 |
| 8.3 | Edit decision table           | Edit decision table in DMN modeler    |    ❌    |                                                 |
| 8.4 | Test decision table           | Test decision table execution         |    ❌    |                                                 |

---

### Feature 9 — Plugin Management

#### 9A · Plugin Overview

| #   | Function                            | Test Scenarios                                                                             | Coverage | Notes                                           |
|:----|:------------------------------------|:-------------------------------------------------------------------------------------------|:--------:|:------------------------------------------------|
| 9.1 | View plugin configurations list     | Display list of all plugin configurations · Display empty state when no plugins configured |    ✅    | plugin.spec.ts                                  |
| 9.2 | View plugin configuration name      | Display configuration name in list view                                                    |    ✅    | plugin.spec.ts                                  |
| 9.3 | View plugin name (API type)         | Display plugin API type in list                                                            |    ✅    | plugin.spec.ts                                  |
| 9.4 | View plugin identifier              | Display UUID identifier in list                                                            |    ✅    | plugin.spec.ts                                  |
| 9.5 | Browse available plugins            | Navigate through plugin catalog · View plugin details in catalog                           |    ✅    | plugin.spec.ts                                  |
| 9.6 | View plugin categories              | Display categorized plugin list                                                            |   `N/A`  | No category grouping in UI                      |
| 9.7 | View plugin descriptions with logos | Display plugin with logo and description                                                   |    ✅    | plugin.spec.ts                                  |
| 9.8 | Filter/search plugins               | Search plugins by name · Filter plugins by type                                            |   `N/A`  | No search/filter in plugin overview              |

#### 9B · Create Plugin Config

| #    | Function                         | Test Scenarios                                                                                                    | Coverage | Notes                                           |
|:-----|:---------------------------------|:------------------------------------------------------------------------------------------------------------------|:--------:|:------------------------------------------------|
| 9.9  | Configure plugin (2-step wizard) | Complete 2-step wizard flow                                                                                       |    ✅    | plugin.spec.ts                                  |
| 9.10 | Choose plugin type from catalog  | Select plugin type in step 1                                                                                      |    ✅    | plugin.spec.ts                                  |
| 9.11 | Enter plugin data (step 2)       | Fill in all required fields in step 2                                                                             |    ✅    | plugin.spec.ts                                  |
| 9.12 | Auto-generate configuration ID   | Verify UUID is auto-generated                                                                                     |    ❌    |                                                 |
| 9.13 | Enter configuration name         | Enter and validate required configuration name · Cannot save without configuration name                           |    ✅    | plugin.spec.ts                                  |
| 9.14 | Enter RSIN                       | Enter RSIN for plugins that require it                                                                            |    ✅    | plugin.spec.ts                                  |
| 9.15 | Enter plugin API URL             | Enter and validate required API URL · Cannot save without API URL · Show validation error for invalid URL format  |    ✅    | plugin.spec.ts                                  |
| 9.16 | Select authentication plugin     | Select required authentication plugin configuration · Cannot save without authentication plugin                   |    ✅    | plugin.spec.ts                                  |
| 9.17 | View authentication options      | View available authentication options in dropdown                                                                 |    ❌    |                                                 |
| 9.18 | Save plugin configuration        | Successfully save new plugin configuration · Show success message after save · Redirect to plugin list after save |    ✅    | plugin.spec.ts                                  |
| 9.19 | Cancel plugin configuration      | Cancel wizard without saving · Show confirmation dialog before canceling                                          |    ❌    |                                                 |

#### 9C · Edit Plugin Config

| #    | Function                           | Test Scenarios                                                                                                             | Coverage | Notes                                           |
|:-----|:-----------------------------------|:---------------------------------------------------------------------------------------------------------------------------|:--------:|:------------------------------------------------|
| 9.20 | Open existing plugin configuration | Open plugin configuration for editing                                                                                      |    ✅    | plugin.spec.ts                                  |
| 9.21 | View configuration ID              | Verify read-only UUID is displayed                                                                                         |    ❌    |                                                 |
| 9.22 | Edit configuration name            | Update configuration name                                                                                                  |    ✅    | plugin.spec.ts                                  |
| 9.23 | Edit RSIN                          | Update RSIN value                                                                                                          |    ❌    |                                                 |
| 9.24 | Edit API URL                       | Update plugin API URL                                                                                                      |    ❌    |                                                 |
| 9.25 | Change authentication plugin       | Change selected authentication plugin                                                                                      |    ❌    |                                                 |
| 9.26 | Save configuration changes         | Successfully save changes to existing configuration                                                                        |    ✅    | plugin.spec.ts                                  |
| 9.27 | Delete plugin configuration        | Delete plugin configuration with confirmation · Show confirmation dialog before delete · Show success message after delete |    ✅    | plugin.spec.ts                                  |

---

### Feature 10 — Dashboard Management

#### 10A · Dashboard Config

| #    | Function                  | Test Scenarios                                        | Coverage | Notes                                           |
|:-----|:--------------------------|:------------------------------------------------------|:--------:|:------------------------------------------------|
| 10.1 | View dashboard list       | Display list of dashboards                            |    ✅    | dashboard-management.spec.ts                    |
| 10.2 | Create dashboard          | Create new dashboard                                  |    ✅    | dashboard-management.spec.ts                    |
| 10.3 | Edit dashboard            | Edit existing dashboard                               |    ✅    | dashboard-management.spec.ts                    |
| 10.4 | View dashboard metadata   | View metadata (created by, created on, dashboard key) |    ✅    | dashboard-management.spec.ts                    |
| 10.5 | Toggle JSON/visual editor | Toggle between JSON and visual editor                 |    ✅    | dashboard-management.spec.ts                    |
| 10.6 | Edit dashboard JSON       | Edit dashboard JSON directly                          |    ✅    | dashboard-management.spec.ts                    |

#### 10B · Widget Management

| #     | Function                  | Test Scenarios                  | Coverage | Notes                                           |
|:------|:--------------------------|:--------------------------------|:--------:|:------------------------------------------------|
| 10.7  | View widgets list         | Display widgets list            |    ✅    | dashboard-management.spec.ts                    |
| 10.8  | Add new widget            | Add new widget to dashboard     |    ✅    | dashboard-management.spec.ts                    |
| 10.9  | Rearrange widgets         | Rearrange widgets via drag-drop |    ✅    | dashboard-management.spec.ts                    |
| 10.10 | Delete widget             | Delete widget from dashboard    |    ✅    | dashboard-management.spec.ts                    |
| 10.11 | Edit widget configuration | Edit widget configuration       |    ✅    | dashboard-management.spec.ts                    |

#### 10C · Widget Config — Data

| #     | Function                     | Test Scenarios                                                                        | Coverage | Notes                                           |
|:------|:-----------------------------|:--------------------------------------------------------------------------------------|:--------:|:------------------------------------------------|
| 10.12 | Select widget type           | Select widget type (Case count / Multiple / Group by / Task count)                    |    ❌    |                                                 |
| 10.13 | Enter widget title           | Enter widget title                                                                    |    ❌    |                                                 |
| 10.14 | Select data source           | Select data source (Case count / Case counts / Task count)                            |    ❌    |                                                 |
| 10.15 | Select case type             | Select case type for case count widgets                                               |    ❌    |                                                 |
| 10.16 | Add conditions               | Add conditions to filter data                                                         |    ❌    |                                                 |
| 10.17 | Configure condition path     | Configure condition query path                                                        |    ❌    |                                                 |
| 10.18 | Configure condition operator | Configure condition query operator                                                    |    ❌    |                                                 |
| 10.19 | Configure condition value    | Configure condition query value                                                       |    ❌    |                                                 |
| 10.20 | Use placeholders             | Use placeholders in conditions (`${null}`, `${currentUserId}`, `${currentUserEmail}`) |    ❌    |                                                 |

#### 10D · Widget Config — Display

| #     | Function                   | Test Scenarios                           | Coverage | Notes                                           |
|:------|:---------------------------|:-----------------------------------------|:--------:|:------------------------------------------------|
| 10.21 | Select display type        | Select display type (Big number / Gauge) |    ❌    |                                                 |
| 10.22 | Configure display title    | Configure display type title             |    ❌    |                                                 |
| 10.23 | Configure display subtitle | Configure display type subtitle          |    ❌    |                                                 |
| 10.24 | Configure display label    | Configure display type label             |    ❌    |                                                 |
| 10.25 | Toggle KPI usage           | Toggle KPI usage                         |    ❌    |                                                 |
| 10.26 | Set URL path               | Set URL path for widget click navigation |    ❌    |                                                 |

#### 10E · Widget Types

| #     | Function                    | Test Scenarios                                       | Coverage | Notes                                           |
|:------|:----------------------------|:-----------------------------------------------------|:--------:|:------------------------------------------------|
| 10.27 | Configure Case count widget | Configure Case count widget (single case type count) |    ❌    |                                                 |
| 10.28 | Configure Multiple counts   | Configure Multiple case counts widget                |    ❌    |                                                 |
| 10.29 | Configure Group by widget   | Configure Group by widget                            |    ❌    |                                                 |
| 10.30 | Configure Task count widget | Configure Task count widget                          |    ❌    |                                                 |

---

### Feature 11 — Access Control Management

#### 11A · Role Management

| #    | Function                  | Test Scenarios               | Coverage | Notes                                           |
|:-----|:--------------------------|:-----------------------------|:--------:|:------------------------------------------------|
| 11.1 | View roles list           | Display list of roles        |    ✅    | access-control.spec.ts                          |
| 11.2 | Add new role              | Add new role                 |    ✅    | access-control.spec.ts                          |
| 11.3 | Enter role name           | Enter role name              |    ✅    | access-control.spec.ts                          |
| 11.4 | Create role               | Create role                  |    ✅    | access-control.spec.ts                          |
| 11.5 | View role details         | Select and view role details |    ✅    | access-control.spec.ts                          |
| 11.6 | Edit role metadata        | Edit role metadata           |    ❌    |                                                 |
| 11.7 | Export role configuration | Export role configuration    |    ❌    |                                                 |
| 11.8 | Delete role               | Delete role                  |    ✅    | access-control.spec.ts                          |

#### 11B · Permissions

| #     | Function                       | Test Scenarios                               | Coverage | Notes                                           |
|:------|:-------------------------------|:---------------------------------------------|:--------:|:------------------------------------------------|
| 11.9  | View role permissions          | View role permissions (JSON / visual toggle) |    ❌    |                                                 |
| 11.10 | Edit permissions JSON          | Edit permissions in JSON format              |    ❌    |                                                 |
| 11.11 | Configure resource permissions | Configure resource-level permissions         |    ❌    |                                                 |
| 11.12 | Set permission conditions      | Set permission conditions                    |    ❌    |                                                 |
| 11.13 | Save role permissions          | Save role permissions                        |    ❌    |                                                 |

---

### Feature 12 — Object Management

| #    | Function                       | Test Scenarios                 | Coverage | Notes                                           |
|:-----|:-------------------------------|:-------------------------------|:--------:|:------------------------------------------------|
| 12.1 | Manage object types            | Manage object types            |    ❌    |                                                 |
| 12.2 | Edit object type configuration | Edit object type configuration |    ❌    |                                                 |

---

### Feature 13 — Building Block Management

#### 13A · BB Overview

| #    | Function                      | Test Scenarios                                     | Coverage | Notes                                           |
|:-----|:------------------------------|:---------------------------------------------------|:--------:|:------------------------------------------------|
| 13.1 | View building blocks list     | Display list of building blocks                    |    ❌    |                                                 |
| 13.2 | View BB metadata              | View building block name, key, and version         |    ❌    |                                                 |
| 13.3 | Upload BB definition          | Upload building block definition (ZIP, max 500 kb) |    ❌    |                                                 |
| 13.4 | Acknowledge overwrite warning | Acknowledge overwrite warning for existing blocks  |    ❌    |                                                 |
| 13.5 | Create new building block     | Create new building block                          |    ❌    |                                                 |
| 13.6 | Enter BB name                 | Enter building block name                          |    ❌    |                                                 |
| 13.7 | Auto-generate BB key          | Auto-generate building block key                   |    ❌    |                                                 |
| 13.8 | Enter BB version              | Enter building block version                       |    ❌    |                                                 |
| 13.9 | Enter BB description          | Enter building block description                   |    ❌    |                                                 |

#### 13B · BB Details

| #     | Function                  | Test Scenarios                                       | Coverage | Notes                                           |
|:------|:--------------------------|:-----------------------------------------------------|:--------:|:------------------------------------------------|
| 13.10 | View BB general info      | View building block general information              |    ❌    |                                                 |
| 13.11 | View BB document tab      | View building block document tab                     |    ❌    |                                                 |
| 13.12 | View BB processes tab     | View building block processes tab                    |    ❌    |                                                 |
| 13.13 | View plugin configuration | View plugin configuration used (e.g. Zaak API)       |    ❌    |                                                 |
| 13.14 | Upload/update BB artwork  | Upload or update building block artwork              |    ❌    |                                                 |
| 13.15 | Delete BB artwork         | Delete building block artwork                        |    ❌    |                                                 |
| 13.16 | Save BB metadata          | Save building block metadata                         |    ❌    |                                                 |
| 13.17 | Export BB as ZIP          | Export building block as ZIP                         |    ❌    |                                                 |
| 13.18 | Create draft version      | Create draft version                                 |    ❌    |                                                 |
| 13.19 | Enter version tag         | Enter new version tag for draft                      |    ❌    |                                                 |
| 13.20 | View version status badge | View version status badge (`DRAFT` / `RELEASE`)      |    ❌    |                                                 |
| 13.21 | Switch versions           | Switch between versions via dropdown                 |    ❌    |                                                 |
| 13.22 | Finalize draft version    | Finalize draft version (convert `DRAFT` → `RELEASE`) |    ❌    |                                                 |

#### 13C · BB Document

| #     | Function                   | Test Scenarios                                               | Coverage | Notes                                           |
|:------|:---------------------------|:-------------------------------------------------------------|:--------:|:------------------------------------------------|
| 13.23 | View BB document structure | View building block document structure (JSON)                |    ❌    |                                                 |
| 13.24 | Edit document structure    | Edit document structure in JSON editor                       |    ❌    |                                                 |
| 13.25 | Manage required fields     | Manage required fields with checkboxes                       |    ❌    |                                                 |
| 13.26 | View field types           | View field types (`string`, `object`, `array`, `boolean`, …) |    ❌    |                                                 |
| 13.27 | View field descriptions    | View field descriptions                                      |    ❌    |                                                 |
| 13.28 | Search/filter fields       | Search and filter document fields                            |    ❌    |                                                 |
| 13.29 | Save document config       | Save document configuration                                  |    ❌    |                                                 |

#### 13D · BB Processes

| #     | Function                   | Test Scenarios                               | Coverage | Notes                                           |
|:------|:---------------------------|:---------------------------------------------|:--------:|:------------------------------------------------|
| 13.30 | View processes list        | View processes list in building block        |    ❌    |                                                 |
| 13.31 | View process metadata      | View process name and key                    |    ❌    |                                                 |
| 13.32 | Manage process definitions | Manage process definitions                   |    ❌    |                                                 |
| 13.33 | View process diagram       | View process diagram/modeler                 |    ❌    |                                                 |
| 13.34 | Select process step        | Select process step in diagram               |    ❌    |                                                 |
| 13.35 | View step properties       | View step properties panel                   |    ❌    |                                                 |
| 13.36 | Configure step settings    | Configure step-specific settings             |    ❌    |                                                 |
| 13.37 | Link steps to actions      | Link process steps to building block actions |    ❌    |                                                 |
| 13.38 | Save process config        | Save process configuration                   |    ❌    |                                                 |

#### 13E · BB Plugin Integration

| #     | Function                       | Test Scenarios                             | Coverage | Notes                                           |
|:------|:-------------------------------|:-------------------------------------------|:--------:|:------------------------------------------------|
| 13.39 | View available plugins         | View available process plugins             |    ❌    |                                                 |
| 13.40 | Select plugin for step         | Select plugin for process step             |    ❌    |                                                 |
| 13.41 | Configure plugin properties    | Configure plugin-specific properties       |    ❌    |                                                 |
| 13.42 | View plugin requirements       | View plugin requirements and descriptions  |    ❌    |                                                 |
| 13.43 | Link action to plugin          | Link action to plugin definition           |    ❌    |                                                 |
| 13.44 | Configure execution properties | Configure execution properties for plugins |    ❌    |                                                 |
| 13.45 | View plugin warnings           | View plugin configuration warnings         |    ❌    |                                                 |

---

### Feature 14 — Translation Management

#### 14A · Translations

| #    | Function                  | Test Scenarios                              | Coverage | Notes                                           |
|:-----|:--------------------------|:--------------------------------------------|:--------:|:------------------------------------------------|
| 14.1 | View translations table   | View translations table                     |    ❌    |                                                 |
| 14.2 | View translation keys     | View translation keys column                |    ❌    |                                                 |
| 14.3 | View language columns     | View language columns (English, Nederlands) |    ❌    |                                                 |
| 14.4 | Add translation row       | Add translation row                         |    ❌    |                                                 |
| 14.5 | Enter translation key     | Enter translation key                       |    ❌    |                                                 |
| 14.6 | Enter English translation | Enter English translation                   |    ❌    |                                                 |
| 14.7 | Enter Dutch translation   | Enter Dutch (Nederlands) translation        |    ❌    |                                                 |
| 14.8 | Delete translation row    | Delete translation row                      |    ❌    |                                                 |

#### 14B · Save

| #     | Function               | Test Scenarios                | Coverage | Notes                                           |
|:------|:-----------------------|:------------------------------|:--------:|:------------------------------------------------|
| 14.9  | Save translations      | Save translations             |    ❌    |                                                 |
| 14.10 | Save and reload app    | Save and reload application   |    ❌    |                                                 |
| 14.11 | View save confirmation | View save confirmation dialog |    ❌    |                                                 |
| 14.12 | Cancel save operation  | Cancel save operation         |    ❌    |                                                 |

---

### Feature 15 — IKO Management

#### 15A · IKO Server

| #     | Function                 | Test Scenarios                          | Coverage | Notes                                           |
|:------|:-------------------------|:----------------------------------------|:--------:|:------------------------------------------------|
| 15.1  | View IKO servers list    | View IKO servers list                   |    ❌    |                                                 |
| 15.2  | Configure IKO server     | Configure IKO server                    |    ❌    |                                                 |
| 15.3  | Enter server title       | Enter server title                      |    ❌    |                                                 |
| 15.4  | Auto-generate server key | Auto-generate server key                |    ❌    |                                                 |
| 15.5  | Enter IKO server URL     | Enter IKO server URL                    |    ❌    |                                                 |
| 15.6  | Save IKO server config   | Save IKO server configuration           |    ❌    |                                                 |
| 15.7  | Edit IKO server          | Edit IKO server                         |    ❌    |                                                 |
| 15.8  | Delete IKO server        | Delete IKO server                       |    ❌    |                                                 |
| 15.9  | View delete confirmation | View delete confirmation dialog         |    ❌    |                                                 |
| 15.10 | Import IKO definition    | Import IKO definition (ZIP, max 500 kb) |    ❌    |                                                 |
| 15.11 | Select file for import   | Select file for import                  |    ❌    |                                                 |
| 15.12 | Cancel import            | Cancel import                           |    ❌    |                                                 |

#### 15B · View Management

| #     | Function                     | Test Scenarios                     | Coverage | Notes                                           |
|:------|:-----------------------------|:-----------------------------------|:--------:|:------------------------------------------------|
| 15.13 | View IKO views list          | View IKO views list                |    ❌    |                                                 |
| 15.14 | Add view                     | Add view                           |    ❌    |                                                 |
| 15.15 | Enter view title             | Enter view title                   |    ❌    |                                                 |
| 15.16 | Auto-generate view key       | Auto-generate view key             |    ❌    |                                                 |
| 15.17 | Enter connector reference    | Enter connector reference          |    ❌    |                                                 |
| 15.18 | Enter connector instance ref | Enter connector instance reference |    ❌    |                                                 |
| 15.19 | Enter endpoint reference     | Enter endpoint reference           |    ❌    |                                                 |
| 15.20 | Add key value pairs          | Add key value pairs                |    ❌    |                                                 |
| 15.21 | Save view                    | Save view                          |    ❌    |                                                 |
| 15.22 | Edit view                    | Edit view                          |    ❌    |                                                 |
| 15.23 | Delete view                  | Delete view                        |    ❌    |                                                 |

#### 15C · Search Actions

| #     | Function                   | Test Scenarios             | Coverage | Notes                                           |
|:------|:---------------------------|:---------------------------|:--------:|:------------------------------------------------|
| 15.24 | View search actions tab    | View search actions tab    |    ❌    |                                                 |
| 15.25 | View search actions list   | View search actions list   |    ❌    |                                                 |
| 15.26 | Add search action          | Add search action          |    ❌    |                                                 |
| 15.27 | Enter search action title  | Enter search action title  |    ❌    |                                                 |
| 15.28 | Enter search action key    | Enter search action key    |    ❌    |                                                 |
| 15.29 | Delete search action       | Delete search action       |    ❌    |                                                 |
| 15.30 | View search action details | View search action details |    ❌    |                                                 |

#### 15D · Search Fields

| #     | Function                | Test Scenarios                                | Coverage | Notes                                           |
|:------|:------------------------|:----------------------------------------------|:--------:|:------------------------------------------------|
| 15.31 | View search fields list | View search fields list                       |    ❌    |                                                 |
| 15.32 | Add search field        | Add search field                              |    ❌    |                                                 |
| 15.33 | Enter field title       | Enter field title (e.g. `BSN`)                |    ❌    |                                                 |
| 15.34 | Enter field key         | Enter field key (e.g. `bsn`)                  |    ❌    |                                                 |
| 15.35 | Enter field path        | Enter field path (e.g. `burgerservicenummer`) |    ❌    |                                                 |
| 15.36 | Select data type        | Select data type dropdown (`Text`)            |    ❌    |                                                 |
| 15.37 | Select match type       | Select match type (`Exact`)                   |    ❌    |                                                 |
| 15.38 | Select field type       | Select field type (`Single`)                  |    ❌    |                                                 |
| 15.39 | Set field as required   | Set field as required (toggle)                |    ❌    |                                                 |
| 15.40 | Save search field       | Save search field                             |    ❌    |                                                 |
| 15.41 | Edit search field       | Edit search field                             |    ❌    |                                                 |
| 15.42 | Delete search field     | Delete search field                           |    ❌    |                                                 |

#### 15E · List Columns

| #     | Function                 | Test Scenarios                                        | Coverage | Notes                                           |
|:------|:-------------------------|:------------------------------------------------------|:--------:|:------------------------------------------------|
| 15.43 | View list tab            | View list tab                                         |    ❌    |                                                 |
| 15.44 | View list columns        | View list columns (Title, Key, Path, Display Type, …) |    ❌    |                                                 |
| 15.45 | Add column               | Add column                                            |    ❌    |                                                 |
| 15.46 | Enter column title       | Enter column title                                    |    ❌    |                                                 |
| 15.47 | Auto-generate column key | Auto-generate column key                              |    ❌    |                                                 |
| 15.48 | Enter column path        | Enter column path (e.g. `/basisgegevens/bsn`)         |    ❌    |                                                 |
| 15.49 | Toggle sorting enabled   | Toggle sorting enabled                                |    ❌    |                                                 |
| 15.50 | Select default sort      | Select default sort                                   |    ❌    |                                                 |
| 15.51 | Select display type      | Select display type (`hidden`, `Text`)                |    ❌    |                                                 |
| 15.52 | Save column              | Save column                                           |    ❌    |                                                 |
| 15.53 | Edit column              | Edit column                                           |    ❌    |                                                 |
| 15.54 | Reorder columns          | Reorder columns (drag handle)                         |    ❌    |                                                 |

#### 15F · Tabs

| #     | Function                | Test Scenarios                                        | Coverage | Notes                                           |
|:------|:------------------------|:------------------------------------------------------|:--------:|:------------------------------------------------|
| 15.55 | View tabs tab           | View tabs tab                                         |    ❌    |                                                 |
| 15.56 | View tabs list          | View tabs list (Key, Tab title, Tab type, Properties) |    ❌    |                                                 |
| 15.57 | Add tab                 | Add tab                                               |    ❌    |                                                 |
| 15.58 | Enter tab title         | Enter tab title                                       |    ❌    |                                                 |
| 15.59 | Auto-generate tab key   | Auto-generate tab key                                 |    ❌    |                                                 |
| 15.60 | Select tab type         | Select tab type dropdown                              |    ❌    |                                                 |
| 15.61 | Enter data profile name | Enter aggregated data profile name (optional)         |    ❌    |                                                 |
| 15.62 | Save tab                | Save tab                                              |    ❌    |                                                 |
| 15.63 | Edit tab                | Edit tab                                              |    ❌    |                                                 |
| 15.64 | Delete tab              | Delete tab                                            |    ❌    |                                                 |

#### 15G · IKO Widgets

| #     | Function                  | Test Scenarios                                                             | Coverage | Notes                                           |
|:------|:--------------------------|:---------------------------------------------------------------------------|:--------:|:------------------------------------------------|
| 15.65 | View widget details page  | View IKO widget details page                                               |    ❌    |                                                 |
| 15.66 | View widgets list         | View widgets list                                                          |    ❌    |                                                 |
| 15.67 | View widget properties    | View widget properties (Title, Type, Key, Width, Density, High contrast)   |    ❌    |                                                 |
| 15.68 | Toggle visual/JSON editor | Toggle visual/JSON editor                                                  |    ❌    |                                                 |
| 15.69 | Edit widgets JSON         | Edit widgets in JSON editor                                                |    ❌    |                                                 |
| 15.70 | Add widget divider        | Add widget divider                                                         |    ❌    |                                                 |
| 15.71 | Enter divider title       | Enter divider title (optional)                                             |    ❌    |                                                 |
| 15.72 | Auto-generate divider key | Auto-generate divider key                                                  |    ❌    |                                                 |
| 15.73 | Create widget             | Create widget                                                              |    ❌    |                                                 |
| 15.74 | Choose widget type        | Choose widget type (Fields / Table / Interactive table / Collection / Map) |    ❌    |                                                 |
| 15.75 | Save widget configuration | Save widget configuration                                                  |    ❌    |                                                 |

---

### Feature 16 — Choice Fields Management

| #    | Function                        | Test Scenarios                           | Coverage | Notes                                           |
|:-----|:--------------------------------|:-----------------------------------------|:--------:|:------------------------------------------------|
| 16.1 | Manage choice field definitions | Manage choice field definitions          |    ❌    |                                                 |
| 16.2 | Add/edit/delete choice options  | Add / edit / delete choice field options |    ❌    |                                                 |

---

### Feature 17 — Failed Notifications

| #    | Function                  | Test Scenarios            | Coverage | Notes                                           |
|:-----|:--------------------------|:--------------------------|:--------:|:------------------------------------------------|
| 17.1 | View failed notifications | View failed notifications |    ❌    |                                                 |
| 17.2 | Retry notification        | Retry failed notification |    ❌    |                                                 |
| 17.3 | Delete notification       | Delete notification       |    ❌    |                                                 |

---

### Feature 18 — Logs

| #    | Function              | Test Scenarios         | Coverage | Notes                                           |
|:-----|:----------------------|:-----------------------|:--------:|:------------------------------------------------|
| 18.1 | View application logs | View application logs  |    ❌    |                                                 |
| 18.2 | Filter/search logs    | Filter and search logs |    ❌    |                                                 |

---

### Feature 19 — Case Migration *(Beta)*

| #    | Function              | Test Scenarios                 | Coverage | Notes                                           |
|:-----|:----------------------|:-------------------------------|:--------:|:------------------------------------------------|
| 19.1 | Migrate cases         | Migrate cases between versions |    ❌    |                                                 |
| 19.2 | View migration status | View migration status          |    ❌    |                                                 |

---

### Feature 20 — Process Migration

| #    | Function                  | Test Scenarios            | Coverage | Notes                                           |
|:-----|:--------------------------|:--------------------------|:--------:|:------------------------------------------------|
| 20.1 | Migrate process instances | Migrate process instances |    ❌    |                                                 |
| 20.2 | View migration status     | View migration status     |    ❌    |                                                 |

---

## 📈 Coverage Summary

| Metric                   |  Count  |
|:-------------------------|:-------:|
| Total Features           |   20    |
| Total Functions          |   356   |
| ✅ Covered by Playwright |   155   |
| ❌ Not covered           |   198   |
| ⏳ In progress           |    1    |
| `N/A` Not applicable     |    2    |
| **Coverage %**           | **43.5%** |
