# Valtimo Frontend Feature & Function List

**Purpose:** Countable list of features and functions for KPI tracking, E2E test planning and documentation.

**Legend:**
- **Feature** = High-level capability (e.g. "Case Definition Management")
- **Function** = Specific action/operation within a feature (e.g. "Create Process")
- **Test Scenario** = Specific test case for a function with reference to E2E test file
- **Component** = Frontend component that provides the functionality
- **Path** = Browser URL path where the function is available

**Status:** 🟢 Documented with screenshots | 🟡 Identified, no screenshots | 🔴 Yet to process

---

## Summary

| Category | Number of Features | Number of Functions |
|----------|-------------------|-------------------|
| User Features | 5 | 21 |
| Admin Features | 16 | 336 |
| **Total** | **21** | **357** |

---

## User Features (ROLE_USER)

### Feature 1: Dashboard 🟡

| Function # | Function Name | Component | Path | Test Scenarios | Doc |
|-----------|---------------|-----------|------|----------------|-----|
| 1.1 | Display widget-based dashboard | _TBD_ | _TBD_ | <ul><li>⬜ Load dashboard with multiple widgets (_TBD_)</li><li>⬜ Display empty dashboard (_TBD_)</li></ul> | 🔴 |
| 1.2 | Configure widgets per user/role | _TBD_ | _TBD_ | <ul><li>⬜ Add widget to dashboard (_TBD_)</li><li>⬜ Remove widget from dashboard (_TBD_)</li></ul> | 🔴 |
| 1.3 | Real-time data updates (SSE) | _TBD_ | _TBD_ | <ul><li>⬜ Receive SSE update and refresh widget (_TBD_)</li></ul> | 🔴 |

### Feature 2: Cases (User) 🔴

| Function # | Function Name | Component | Path | Test Scenarios | Doc |
|-----------|---------------|-----------|------|----------------|-----|
| 2.1 | View cases overview per definition | _TBD_ | _TBD_ | <ul><li>⬜ Display cases overview for specific definition (_TBD_)</li></ul> | 🔴 |
| 2.2 | View case details (tabs) | _TBD_ | _TBD_ | <ul><li>⬜ Navigate and view case details with tabs (_TBD_)</li></ul> | 🔴 |
| 2.3 | Search/filter cases | _TBD_ | _TBD_ | <ul><li>⬜ Search cases by criteria (_TBD_)</li><li>⬜ Filter cases using filters (_TBD_)</li></ul> | 🔴 |
| 2.4 | View case documents | _TBD_ | _TBD_ | <ul><li>⬜ Display list of case documents (_TBD_)</li></ul> | 🔴 |
| 2.5 | View case progress/status | _TBD_ | _TBD_ | <ul><li>⬜ View current case progress and status (_TBD_)</li></ul> | 🔴 |
| 2.6 | Execute tasks within case | _TBD_ | _TBD_ | <ul><li>⬜ Execute task from case detail view (_TBD_)</li></ul> | 🔴 |

### Feature 3: Tasks 🟡

| Function # | Function Name | Component | Path | Test Scenarios | Doc |
|-----------|---------------|-----------|------|----------------|-----|
| 3.1 | View all open tasks | _TBD_ | _TBD_ | <ul><li>⬜ Display list of all open tasks (_TBD_)</li></ul> | 🔴 |
| 3.2 | Filter/sort tasks | _TBD_ | _TBD_ | <ul><li>⬜ Filter tasks by criteria (_TBD_)</li><li>⬜ Sort tasks by column (_TBD_)</li></ul> | 🔴 |
| 3.3 | View task details | _TBD_ | _TBD_ | <ul><li>⬜ Open and view task details (_TBD_)</li></ul> | 🔴 |
| 3.4 | Claim task | _TBD_ | _TBD_ | <ul><li>⬜ Claim an unassigned task (_TBD_)</li></ul> | 🔴 |
| 3.5 | Execute task (fill form) | _TBD_ | _TBD_ | <ul><li>⬜ Fill in task form fields (_TBD_)</li></ul> | 🔴 |
| 3.6 | Complete task | _TBD_ | _TBD_ | <ul><li>⬜ Submit and complete task (_TBD_)</li></ul> | 🔴 |

### Feature 4: Objects 🟡

| Function # | Function Name | Component | Path | Test Scenarios | Doc |
|-----------|---------------|-----------|------|----------------|-----|
| 4.1 | View objects per type | _TBD_ | _TBD_ | <ul><li>⬜ Display objects filtered by type (_TBD_)</li></ul> | 🔴 |
| 4.2 | View object details | _TBD_ | _TBD_ | <ul><li>⬜ Open and view object details (_TBD_)</li></ul> | 🔴 |
| 4.3 | Search/filter objects | _TBD_ | _TBD_ | <ul><li>⬜ Search objects by criteria (_TBD_)</li><li>⬜ Filter objects using filters (_TBD_)</li></ul> | 🔴 |

### Feature 5: Views / Images (IKO User) 🟡

| Function # | Function Name | Component | Path | Test Scenarios | Doc |
|-----------|---------------|-----------|------|----------------|-----|
| 5.1 | Search IKO objects | _TBD_ | _TBD_ | <ul><li>⬜ Search for IKO objects using search criteria (_TBD_)</li></ul> | 🔴 |
| 5.2 | View search results | _TBD_ | _TBD_ | <ul><li>⬜ Display IKO search results list (_TBD_)</li></ul> | 🔴 |
| 5.3 | View IKO object details | _TBD_ | _TBD_ | <ul><li>⬜ Open and view detailed IKO object information (_TBD_)</li></ul> | 🔴 |

---

## Admin Features (ROLE_ADMIN)

### Feature 6: Case Definition Management 🟢

| Section | Function # | Function Name | Component | Path | Test Scenarios | Doc |
|---------|-----------|---------------|-----------|------|----------------|-----|
| **6A. General** | 6.1 | Link upload process to case | _TBD_ | _TBD_ | <ul><li>⬜ Link upload process to case definition (_TBD_)</li></ul> | 🔴 |
| 6A | 6.2 | Set case handler toggle | _TBD_ | _TBD_ | <ul><li>⬜ Enable/disable case handler (_TBD_)</li></ul> | 🔴 |
| 6A | 6.3 | Set auto-assign tasks toggle | _TBD_ | _TBD_ | <ul><li>⬜ Enable/disable auto-assign tasks to case handler (_TBD_)</li></ul> | 🔴 |
| 6A | 6.4 | Set external start form toggle | _TBD_ | _TBD_ | <ul><li>⬜ Enable/disable external start form (_TBD_)</li></ul> | 🔴 |
| 6A | 6.5 | Enter external start form URL | _TBD_ | _TBD_ | <ul><li>⬜ Configure external start form URL (_TBD_)</li></ul> | 🔴 |
| **6B. Processes** | 6.6 | View linked processes | _TBD_ | _TBD_ | <ul><li>⬜ Display list of linked processes (_TBD_)</li></ul> | 🔴 |
| 6B | 6.7 | Create new process | _TBD_ | _TBD_ | <ul><li>⬜ Create new BPMN process (_TBD_)</li></ul> | 🔴 |
| 6B | 6.8 | Open process in BPMN modeler | _TBD_ | _TBD_ | <ul><li>⬜ Open process in BPMN editor (_TBD_)</li></ul> | 🔴 |
| 6B | 6.9 | Add BPMN elements | _TBD_ | _TBD_ | <ul><li>⬜ Add BPMN elements via drag-drop (_TBD_)</li></ul> | 🔴 |
| 6B | 6.10 | Set process properties | _TBD_ | _TBD_ | <ul><li>⬜ Configure process properties (Starts case, Startable by user) (_TBD_)</li></ul> | 🔴 |
| 6B | 6.11 | Save process | _TBD_ | _TBD_ | <ul><li>⬜ Save process definition (_TBD_)</li></ul> | 🔴 |
| **6C. Process Links** | 6.12 | Create process link | _TBD_ | _TBD_ | <ul><li>⬜ Create process link via wizard (_TBD_)</li></ul> | 🔴 |
| 6C | 6.13 | Configure Form link type | _TBD_ | _TBD_ | <ul><li>⬜ Configure Form link type (_TBD_)</li></ul> | 🔴 |
| 6C | 6.14 | Configure FormFlow link type | _TBD_ | _TBD_ | <ul><li>⬜ Configure FormFlow link type (_TBD_)</li></ul> | 🔴 |
| 6C | 6.15 | Configure Plugin link type | _TBD_ | _TBD_ | <ul><li>⬜ Configure Plugin link type (_TBD_)</li></ul> | 🔴 |
| 6C | 6.16 | Configure plugin action | _TBD_ | _TBD_ | <ul><li>⬜ Configure plugin action (_TBD_)</li></ul> | 🔴 |
| 6C | 6.17 | Configure Building block link | _TBD_ | _TBD_ | <ul><li>⬜ Configure Building block link type (_TBD_)</li></ul> | 🔴 |
| 6C | 6.18 | Select building block | _TBD_ | _TBD_ | <ul><li>⬜ Select building block from available list (_TBD_)</li></ul> | 🔴 |
| 6C | 6.19 | View building block descriptions | _TBD_ | _TBD_ | <ul><li>⬜ View building block descriptions with artwork (_TBD_)</li></ul> | 🔴 |
| 6C | 6.20 | Select building block version | _TBD_ | _TBD_ | <ul><li>⬜ Select building block version (_TBD_)</li></ul> | 🔴 |
| 6C | 6.21 | Configure plugin mapping | _TBD_ | _TBD_ | <ul><li>⬜ Configure plugin mapping for building block (_TBD_)</li></ul> | 🔴 |
| 6C | 6.22 | Configure input mapping | _TBD_ | _TBD_ | <ul><li>⬜ Configure input mapping (building block to case) (_TBD_)</li></ul> | 🔴 |
| 6C | 6.23 | Add input field mapping | _TBD_ | _TBD_ | <ul><li>⬜ Add input field mapping (_TBD_)</li></ul> | 🔴 |
| 6C | 6.24 | Select source path | _TBD_ | _TBD_ | <ul><li>⬜ Select source path from building block document (_TBD_)</li></ul> | 🔴 |
| 6C | 6.25 | Map to target case field | _TBD_ | _TBD_ | <ul><li>⬜ Map to target case field via dropdown (_TBD_)</li></ul> | 🔴 |
| 6C | 6.26 | Toggle mapping input mode | _TBD_ | _TBD_ | <ul><li>⬜ Toggle between dropdown/manual input for mapping (_TBD_)</li></ul> | 🔴 |
| 6C | 6.27 | Mark fields as required | _TBD_ | _TBD_ | <ul><li>⬜ Mark input fields as required (_TBD_)</li></ul> | 🔴 |
| 6C | 6.28 | Configure sync mapping | _TBD_ | _TBD_ | <ul><li>⬜ Configure sync mapping (case to building block) (_TBD_)</li></ul> | 🔴 |
| 6C | 6.29 | Add sync field mapping | _TBD_ | _TBD_ | <ul><li>⬜ Add sync field mapping (_TBD_)</li></ul> | 🔴 |
| 6C | 6.30 | Select source field from case | _TBD_ | _TBD_ | <ul><li>⬜ Select source field from case (_TBD_)</li></ul> | 🔴 |
| 6C | 6.31 | Map to building block field | _TBD_ | _TBD_ | <ul><li>⬜ Map to target building block field (_TBD_)</li></ul> | 🔴 |
| 6C | 6.32 | Delete mappings | _TBD_ | _TBD_ | <ul><li>⬜ Delete input/sync mappings (_TBD_)</li></ul> | 🔴 |
| 6C | 6.33 | View dependency warnings | _TBD_ | _TBD_ | <ul><li>⬜ View dependency warnings (push config needed) (_TBD_)</li></ul> | 🔴 |
| 6C | 6.34 | Complete building block config | _TBD_ | _TBD_ | <ul><li>⬜ Complete building block configuration (_TBD_)</li></ul> | 🔴 |
| 6C | 6.35 | Save process link | _TBD_ | _TBD_ | <ul><li>⬜ Save process link configuration (_TBD_)</li></ul> | 🔴 |
| **6D. Version Mgmt** | 6.36 | Select version | _TBD_ | _TBD_ | <ul><li>⬜ Select version from dropdown (_TBD_)</li></ul> | 🔴 |
| 6D | 6.37 | View all versions | _TBD_ | _TBD_ | <ul><li>⬜ View all versions (_TBD_)</li></ul> | 🔴 |
| 6D | 6.38 | Manage version | _TBD_ | _TBD_ | <ul><li>⬜ Manage version (_TBD_)</li></ul> | 🔴 |
| **6E. Decision Tables** | 6.39 | View linked decision tables | _TBD_ | _TBD_ | <ul><li>⬜ Display list of linked decision tables (_TBD_)</li></ul> | 🔴 |
| 6E | 6.40 | Upload decision table | _TBD_ | _TBD_ | <ul><li>⬜ Upload decision table (.dmn file) (_TBD_)</li></ul> | 🔴 |
| 6E | 6.41 | Open decision table editor | _TBD_ | _TBD_ | <ul><li>⬜ Open decision table in DMN editor (_TBD_)</li></ul> | 🔴 |
| 6E | 6.42 | Set DMN Hit policy | _TBD_ | _TBD_ | <ul><li>⬜ Set DMN Hit policy (_TBD_)</li></ul> | 🔴 |
| 6E | 6.43 | Manage DMN columns | _TBD_ | _TBD_ | <ul><li>⬜ Manage DMN input/output columns (_TBD_)</li></ul> | 🔴 |
| 6E | 6.44 | Manage DMN rules | _TBD_ | _TBD_ | <ul><li>⬜ Add/edit/delete DMN rules (_TBD_)</li></ul> | 🔴 |
| 6E | 6.45 | Save decision table | _TBD_ | _TBD_ | <ul><li>⬜ Save decision table (_TBD_)</li></ul> | 🔴 |
| **6F. Document** | 6.46 | View JSON Schema | _TBD_ | _TBD_ | <ul><li>⬜ View JSON Schema definition (_TBD_)</li></ul> | 🔴 |
| 6F | 6.47 | Download JSON Schema | _TBD_ | _TBD_ | <ul><li>⬜ Download JSON Schema (_TBD_)</li></ul> | 🔴 |
| 6F | 6.48 | Edit JSON Schema | _TBD_ | _TBD_ | <ul><li>⬜ Edit JSON Schema (_TBD_)</li></ul> | 🔴 |
| 6F | 6.49 | Save JSON Schema | _TBD_ | _TBD_ | <ul><li>⬜ Save JSON Schema changes (_TBD_)</li></ul> | 🔴 |
| **6G. Forms** | 6.50 | View forms list | _TBD_ | _TBD_ | <ul><li>⬜ Display list of forms (_TBD_)</li></ul> | 🔴 |
| 6G | 6.51 | Search/filter forms | _TBD_ | _TBD_ | <ul><li>⬜ Search and filter forms (_TBD_)</li></ul> | 🔴 |
| 6G | 6.52 | Create form | _TBD_ | _TBD_ | <ul><li>⬜ Create new form (_TBD_)</li></ul> | 🔴 |
| 6G | 6.53 | Add form components | _TBD_ | _TBD_ | <ul><li>⬜ Form.io builder - add components via drag-drop (_TBD_)</li></ul> | 🔴 |
| 6G | 6.54 | Configure component | _TBD_ | _TBD_ | <ul><li>⬜ Form.io builder - configure component properties (_TBD_)</li></ul> | 🔴 |
| 6G | 6.55 | Use JSON editor | _TBD_ | _TBD_ | <ul><li>⬜ Use Form.io JSON editor (_TBD_)</li></ul> | 🔴 |
| 6G | 6.56 | View form preview | _TBD_ | _TBD_ | <ul><li>⬜ View form preview (_TBD_)</li></ul> | 🔴 |
| 6G | 6.57 | Save form | _TBD_ | _TBD_ | <ul><li>⬜ Save form definition (_TBD_)</li></ul> | 🔴 |
| **6H. Form Flows** | 6.58 | View form flows list | _TBD_ | _TBD_ | <ul><li>⬜ Display list of form flows (_TBD_)</li></ul> | 🔴 |
| 6H | 6.59 | Create form flow | _TBD_ | _TBD_ | <ul><li>⬜ Create new form flow (_TBD_)</li></ul> | 🔴 |
| 6H | 6.60 | Edit form flow JSON | _TBD_ | _TBD_ | <ul><li>⬜ Edit form flow JSON definition (_TBD_)</li></ul> | 🔴 |
| 6H | 6.61 | Save form flow | _TBD_ | _TBD_ | <ul><li>⬜ Save form flow (_TBD_)</li></ul> | 🔴 |
| **6I. Tasks** | 6.62 | View task list columns | _TBD_ | _TBD_ | <ul><li>⬜ View task list columns configuration (_TBD_)</li></ul> | 🔴 |
| 6I | 6.63 | Add task list column | _TBD_ | _TBD_ | <ul><li>⬜ Add column to task list (_TBD_)</li></ul> | 🔴 |
| 6I | 6.64 | Rearrange task list columns | _TBD_ | _TBD_ | <ul><li>⬜ Rearrange task list columns (_TBD_)</li></ul> | 🔴 |
| 6I | 6.65 | View task search fields | _TBD_ | _TBD_ | <ul><li>⬜ View task list search fields (_TBD_)</li></ul> | 🔴 |
| 6I | 6.66 | Add task search field | _TBD_ | _TBD_ | <ul><li>⬜ Add task list search field (_TBD_)</li></ul> | 🔴 |
| 6I | 6.67 | Toggle JSON/table view | _TBD_ | _TBD_ | <ul><li>⬜ Toggle task list JSON/table view (_TBD_)</li></ul> | 🔴 |
| **6J. Case List** | 6.68 | View case list columns | _TBD_ | _TBD_ | <ul><li>⬜ View case list columns configuration (_TBD_)</li></ul> | 🔴 |
| 6J | 6.69 | Add case list column | _TBD_ | _TBD_ | <ul><li>⬜ Add column to case list (_TBD_)</li></ul> | 🔴 |
| 6J | 6.70 | Rearrange case list columns | _TBD_ | _TBD_ | <ul><li>⬜ Rearrange case list columns (_TBD_)</li></ul> | 🔴 |
| 6J | 6.71 | View case search fields | _TBD_ | _TBD_ | <ul><li>⬜ View case list search fields (_TBD_)</li></ul> | 🔴 |
| 6J | 6.72 | Add case search field | _TBD_ | _TBD_ | <ul><li>⬜ Add case list search field (_TBD_)</li></ul> | 🔴 |
| 6J | 6.73 | Download case list config | _TBD_ | _TBD_ | <ul><li>⬜ Download case list configuration (_TBD_)</li></ul> | 🔴 |
| **6K. Case Details - Tabs** | 6.74 | View tabs | _TBD_ | _TBD_ | <ul><li>⬜ View tabs configuration (_TBD_)</li></ul> | 🔴 |
| 6K | 6.75 | Add tab | _TBD_ | _TBD_ | <ul><li>⬜ Add tab (Standard/FormIO/Custom/Widgets) (_TBD_)</li></ul> | 🔴 |
| 6K | 6.76 | Rearrange tabs | _TBD_ | _TBD_ | <ul><li>⬜ Rearrange tabs order (_TBD_)</li></ul> | 🔴 |
| **6L. Case Details - Statuses** | 6.77 | View statuses | _TBD_ | _TBD_ | <ul><li>⬜ View statuses configuration (_TBD_)</li></ul> | 🔴 |
| 6L | 6.78 | Add status | _TBD_ | _TBD_ | <ul><li>⬜ Add new status (_TBD_)</li></ul> | 🔴 |
| 6L | 6.79 | Set status color | _TBD_ | _TBD_ | <ul><li>⬜ Set status color (_TBD_)</li></ul> | 🔴 |
| 6L | 6.80 | Set status visibility | _TBD_ | _TBD_ | <ul><li>⬜ Set status visibility (_TBD_)</li></ul> | 🔴 |
| 6L | 6.81 | Rearrange statuses | _TBD_ | _TBD_ | <ul><li>⬜ Rearrange statuses order (_TBD_)</li></ul> | 🔴 |
| **6M. Case Details - Tags** | 6.82 | View tags | _TBD_ | _TBD_ | <ul><li>⬜ View tags configuration (_TBD_)</li></ul> | 🔴 |
| 6M | 6.83 | Add tag | _TBD_ | _TBD_ | <ul><li>⬜ Add new tag (_TBD_)</li></ul> | 🔴 |
| 6M | 6.84 | Set tag color | _TBD_ | _TBD_ | <ul><li>⬜ Set tag color (_TBD_)</li></ul> | 🔴 |
| **6N. Case Details - Header** | 6.85 | View header widgets | _TBD_ | _TBD_ | <ul><li>⬜ View header widgets configuration (_TBD_)</li></ul> | 🔴 |
| 6N | 6.86 | Add header widget | _TBD_ | _TBD_ | <ul><li>⬜ Add header widget (_TBD_)</li></ul> | 🔴 |
| **6O. Case Details - Widgets** | 6.87 | View widgets list | _TBD_ | _TBD_ | <ul><li>⬜ View widgets list (_TBD_)</li></ul> | 🔴 |
| 6O | 6.88 | Add widget | _TBD_ | _TBD_ | <ul><li>⬜ Add widget via 6-step wizard (_TBD_)</li></ul> | 🔴 |
| 6O | 6.89 | Select widget type | _TBD_ | _TBD_ | <ul><li>⬜ Select widget type (Fields/Custom/Form.io/Table/Collection/Map) (_TBD_)</li></ul> | 🔴 |
| 6O | 6.90 | Set widget width | _TBD_ | _TBD_ | <ul><li>⬜ Set widget width (_TBD_)</li></ul> | 🔴 |
| 6O | 6.91 | Set widget density | _TBD_ | _TBD_ | <ul><li>⬜ Set widget density (_TBD_)</li></ul> | 🔴 |
| 6O | 6.92 | Set widget style | _TBD_ | _TBD_ | <ul><li>⬜ Set widget style (_TBD_)</li></ul> | 🔴 |
| 6O | 6.93 | Configure widget content | _TBD_ | _TBD_ | <ul><li>⬜ Configure widget content (_TBD_)</li></ul> | 🔴 |
| 6O | 6.94 | Set widget conditions | _TBD_ | _TBD_ | <ul><li>⬜ Set widget display conditions (_TBD_)</li></ul> | 🔴 |
| 6O | 6.95 | Add widget separator | _TBD_ | _TBD_ | <ul><li>⬜ Add widget separator (_TBD_)</li></ul> | 🔴 |
| 6O | 6.96 | Rearrange widgets | _TBD_ | _TBD_ | <ul><li>⬜ Rearrange widgets order (_TBD_)</li></ul> | 🔴 |
| 6O | 6.97 | Use widget JSON editor | _TBD_ | _TBD_ | <ul><li>⬜ Use widget JSON editor (_TBD_)</li></ul> | 🔴 |
| **6P. ZGW - General** | 6.98 | Configure case sync | _TBD_ | _TBD_ | <ul><li>⬜ Configure case details synchronization (_TBD_)</li></ul> | 🔴 |
| 6P | 6.99 | Link case type | _TBD_ | _TBD_ | <ul><li>⬜ Link case type (_TBD_)</li></ul> | 🔴 |
| 6P | 6.100 | Edit case type | _TBD_ | _TBD_ | <ul><li>⬜ Edit case type (_TBD_)</li></ul> | 🔴 |
| 6P | 6.101 | Delete case type | _TBD_ | _TBD_ | <ul><li>⬜ Delete case type (_TBD_)</li></ul> | 🔴 |
| **6Q. ZGW - Doc Columns** | 6.102 | View document columns | _TBD_ | _TBD_ | <ul><li>⬜ View document columns (_TBD_)</li></ul> | 🔴 |
| 6Q | 6.103 | Add document column | _TBD_ | _TBD_ | <ul><li>⬜ Add document column (_TBD_)</li></ul> | 🔴 |
| 6Q | 6.104 | Set column sorting | _TBD_ | _TBD_ | <ul><li>⬜ Set document column sorting (_TBD_)</li></ul> | 🔴 |
| 6Q | 6.105 | Rearrange doc columns | _TBD_ | _TBD_ | <ul><li>⬜ Rearrange document columns (_TBD_)</li></ul> | 🔴 |
| **6R. ZGW - Upload Fields** | 6.106 | View upload fields | _TBD_ | _TBD_ | <ul><li>⬜ View upload fields (_TBD_)</li></ul> | 🔴 |
| 6R | 6.107 | Set field visibility | _TBD_ | _TBD_ | <ul><li>⬜ Set upload field visibility (_TBD_)</li></ul> | 🔴 |
| 6R | 6.108 | Set field default value | _TBD_ | _TBD_ | <ul><li>⬜ Set upload field default value (_TBD_)</li></ul> | 🔴 |
| **6S. ZGW - Keywords** | 6.109 | View keywords | _TBD_ | _TBD_ | <ul><li>⬜ View keywords (_TBD_)</li></ul> | 🔴 |
| 6S | 6.110 | Add keyword | _TBD_ | _TBD_ | <ul><li>⬜ Add keyword (_TBD_)</li></ul> | 🔴 |
| 6S | 6.111 | Search keywords | _TBD_ | _TBD_ | <ul><li>⬜ Search keywords (_TBD_)</li></ul> | 🔴 |

---

### Feature 7: Process Management 🟡

| Function # | Function Name | Component | Path | Test Scenarios | Doc |
|-----------|---------------|-----------|------|----------------|-----|
| 7.1 | View process overview | _TBD_ | _TBD_ | <ul><li>⬜ Display process overview list (_TBD_)</li></ul> | 🔴 |
| 7.2 | Create new process | _TBD_ | _TBD_ | <ul><li>⬜ Create new BPMN process (_TBD_)</li></ul> | 🔴 |
| 7.3 | Edit BPMN process | _TBD_ | _TBD_ | <ul><li>⬜ Edit existing BPMN process (_TBD_)</li></ul> | 🔴 |
| 7.4 | Deploy process | _TBD_ | _TBD_ | <ul><li>⬜ Deploy process definition (_TBD_)</li></ul> | 🔴 |
| 7.5 | Manage process versions | _TBD_ | _TBD_ | <ul><li>⬜ Manage process versions (_TBD_)</li></ul> | 🔴 |

### Feature 8: Decision Table Management 🟡

| Function # | Function Name | Component | Path | Test Scenarios | Doc |
|-----------|---------------|-----------|------|----------------|-----|
| 8.1 | View decision tables overview | _TBD_ | _TBD_ | <ul><li>⬜ Display decision tables overview list (_TBD_)</li></ul> | 🔴 |
| 8.2 | Create decision table | _TBD_ | _TBD_ | <ul><li>⬜ Create new decision table (_TBD_)</li></ul> | 🔴 |
| 8.3 | Edit decision table | _TBD_ | _TBD_ | <ul><li>⬜ Edit decision table in DMN modeler (_TBD_)</li></ul> | 🔴 |
| 8.4 | Test decision table | _TBD_ | _TBD_ | <ul><li>⬜ Test decision table execution (_TBD_)</li></ul> | 🔴 |

### Feature 9: Plugin Management 🟢

| Section | Function # | Function Name | Component | Path | Test Scenarios | Doc |
|---------|-----------|---------------|-----------|------|----------------|-----|
| **9A. Plugin Overview** | 9.1 | View plugin configurations list | _TBD_ | _TBD_ | <ul><li>⬜ Display list of all plugin configurations (_TBD_)</li><li>⬜ Display empty state when no plugins configured (_TBD_)</li></ul> | 🟢 |
| 9A | 9.2 | View plugin configuration name | _TBD_ | _TBD_ | <ul><li>⬜ Display configuration name in list view (_TBD_)</li></ul> | 🟢 |
| 9A | 9.3 | View plugin name (API type) | _TBD_ | _TBD_ | <ul><li>⬜ Display plugin API type in list (_TBD_)</li></ul> | 🟢 |
| 9A | 9.4 | View plugin identifier | _TBD_ | _TBD_ | <ul><li>⬜ Display UUID identifier in list (_TBD_)</li></ul> | 🟢 |
| 9A | 9.5 | Browse available plugins | _TBD_ | _TBD_ | <ul><li>⬜ Navigate through plugin catalog (_TBD_)</li><li>⬜ View plugin details in catalog (_TBD_)</li></ul> | 🟢 |
| 9A | 9.6 | View plugin categories | _TBD_ | _TBD_ | <ul><li>⬜ Display categorized plugin list (_TBD_)</li></ul> | 🟢 |
| 9A | 9.7 | View plugin descriptions with logos | _TBD_ | _TBD_ | <ul><li>⬜ Display plugin with logo and description (_TBD_)</li></ul> | 🟢 |
| 9A | 9.8 | Filter/search plugins | _TBD_ | _TBD_ | <ul><li>⬜ Search plugins by name (_TBD_)</li><li>⬜ Filter plugins by type (_TBD_)</li></ul> | 🟢 |
| **9B. Create Plugin Config** | 9.9 | Configure plugin (2-step wizard) | _TBD_ | _TBD_ | <ul><li>⬜ Complete 2-step wizard flow (_TBD_)</li></ul> | 🟢 |
| 9B | 9.10 | Choose plugin type from catalog | _TBD_ | _TBD_ | <ul><li>⬜ Select plugin type in step 1 (_TBD_)</li></ul> | 🟢 |
| 9B | 9.11 | Enter plugin data (step 2) | _TBD_ | _TBD_ | <ul><li>⬜ Fill in all required fields in step 2 (_TBD_)</li></ul> | 🟢 |
| 9B | 9.12 | Auto-generate configuration ID | _TBD_ | _TBD_ | <ul><li>⬜ Verify UUID is auto-generated (_TBD_)</li></ul> | 🟢 |
| 9B | 9.13 | Enter configuration name | _TBD_ | _TBD_ | <ul><li>⬜ Enter and validate required configuration name (_TBD_)</li><li>⬜ Cannot save without configuration name (_TBD_)</li></ul> | 🟢 |
| 9B | 9.14 | Enter RSIN | _TBD_ | _TBD_ | <ul><li>⬜ Enter RSIN for plugins that require it (_TBD_)</li></ul> | 🟢 |
| 9B | 9.15 | Enter plugin API URL | _TBD_ | _TBD_ | <ul><li>⬜ Enter and validate required API URL (_TBD_)</li><li>⬜ Cannot save without API URL (_TBD_)</li><li>⬜ Show validation error for invalid URL format (_TBD_)</li></ul> | 🟢 |
| 9B | 9.16 | Select authentication plugin | _TBD_ | _TBD_ | <ul><li>⬜ Select required authentication plugin configuration (_TBD_)</li><li>⬜ Cannot save without authentication plugin (_TBD_)</li></ul> | 🟢 |
| 9B | 9.17 | View authentication options | _TBD_ | _TBD_ | <ul><li>⬜ View available authentication options in dropdown (_TBD_)</li></ul> | 🟢 |
| 9B | 9.18 | Save plugin configuration | _TBD_ | _TBD_ | <ul><li>⬜ Successfully save new plugin configuration (_TBD_)</li><li>⬜ Show success message after save (_TBD_)</li><li>⬜ Redirect to plugin list after save (_TBD_)</li></ul> | 🟢 |
| 9B | 9.19 | Cancel plugin configuration | _TBD_ | _TBD_ | <ul><li>⬜ Cancel wizard without saving (_TBD_)</li><li>⬜ Show confirmation dialog before canceling (_TBD_)</li></ul> | 🟢 |
| **9C. Edit Plugin Config** | 9.20 | Open existing plugin configuration | _TBD_ | _TBD_ | <ul><li>⬜ Open plugin configuration for editing (_TBD_)</li></ul> | 🟢 |
| 9C | 9.21 | View configuration ID | _TBD_ | _TBD_ | <ul><li>⬜ Verify read-only UUID is displayed (_TBD_)</li></ul> | 🟢 |
| 9C | 9.22 | Edit configuration name | _TBD_ | _TBD_ | <ul><li>⬜ Update configuration name (_TBD_)</li></ul> | 🟢 |
| 9C | 9.23 | Edit RSIN | _TBD_ | _TBD_ | <ul><li>⬜ Update RSIN value (_TBD_)</li></ul> | 🟢 |
| 9C | 9.24 | Edit API URL | _TBD_ | _TBD_ | <ul><li>⬜ Update plugin API URL (_TBD_)</li></ul> | 🟢 |
| 9C | 9.25 | Change authentication plugin | _TBD_ | _TBD_ | <ul><li>⬜ Change selected authentication plugin (_TBD_)</li></ul> | 🟢 |
| 9C | 9.26 | Save configuration changes | _TBD_ | _TBD_ | <ul><li>⬜ Successfully save changes to existing configuration (_TBD_)</li></ul> | 🟢 |
| 9C | 9.27 | Delete plugin configuration | _TBD_ | _TBD_ | <ul><li>⬜ Delete plugin configuration with confirmation (_TBD_)</li><li>⬜ Show confirmation dialog before delete (_TBD_)</li><li>⬜ Show success message after delete (_TBD_)</li></ul> | 🟢 |

### Feature 10: Dashboard Management 🟢

| Section | Function # | Function Name | Component | Path | Test Scenarios | Doc |
|---------|-----------|---------------|-----------|------|----------------|-----|
| **10A. Dashboard Config** | 10.1 | View dashboard list | _TBD_ | _TBD_ | <ul><li>⬜ Display list of dashboards (_TBD_)</li></ul> | 🔴 |
| 10A | 10.2 | Create dashboard | _TBD_ | _TBD_ | <ul><li>⬜ Create new dashboard (_TBD_)</li></ul> | 🔴 |
| 10A | 10.3 | Edit dashboard | _TBD_ | _TBD_ | <ul><li>⬜ Edit existing dashboard (_TBD_)</li></ul> | 🔴 |
| 10A | 10.4 | View dashboard metadata | _TBD_ | _TBD_ | <ul><li>⬜ View metadata (created by, created on, dashboard key) (_TBD_)</li></ul> | 🔴 |
| 10A | 10.5 | Toggle JSON/visual editor | _TBD_ | _TBD_ | <ul><li>⬜ Toggle between JSON and visual editor (_TBD_)</li></ul> | 🔴 |
| 10A | 10.6 | Edit dashboard JSON | _TBD_ | _TBD_ | <ul><li>⬜ Edit dashboard JSON directly (_TBD_)</li></ul> | 🔴 |
| **10B. Widget Mgmt** | 10.7 | View widgets list | _TBD_ | _TBD_ | <ul><li>⬜ Display widgets list (_TBD_)</li></ul> | 🔴 |
| 10B | 10.8 | Add new widget | _TBD_ | _TBD_ | <ul><li>⬜ Add new widget to dashboard (_TBD_)</li></ul> | 🔴 |
| 10B | 10.9 | Rearrange widgets | _TBD_ | _TBD_ | <ul><li>⬜ Rearrange widgets via drag-drop (_TBD_)</li></ul> | 🔴 |
| 10B | 10.10 | Delete widget | _TBD_ | _TBD_ | <ul><li>⬜ Delete widget from dashboard (_TBD_)</li></ul> | 🔴 |
| 10B | 10.11 | Edit widget configuration | _TBD_ | _TBD_ | <ul><li>⬜ Edit widget configuration (_TBD_)</li></ul> | 🔴 |
| **10C. Widget Config - Data** | 10.12 | Select widget type | _TBD_ | _TBD_ | <ul><li>⬜ Select widget type (Case count/Multiple/Group by/Task count) (_TBD_)</li></ul> | 🔴 |
| 10C | 10.13 | Enter widget title | _TBD_ | _TBD_ | <ul><li>⬜ Enter widget title (_TBD_)</li></ul> | 🔴 |
| 10C | 10.14 | Select data source | _TBD_ | _TBD_ | <ul><li>⬜ Select data source (Case count/Case counts/Task count) (_TBD_)</li></ul> | 🔴 |
| 10C | 10.15 | Select case type | _TBD_ | _TBD_ | <ul><li>⬜ Select case type for case count widgets (_TBD_)</li></ul> | 🔴 |
| 10C | 10.16 | Add conditions | _TBD_ | _TBD_ | <ul><li>⬜ Add conditions to filter data (_TBD_)</li></ul> | 🔴 |
| 10C | 10.17 | Configure condition path | _TBD_ | _TBD_ | <ul><li>⬜ Configure condition query path (_TBD_)</li></ul> | 🔴 |
| 10C | 10.18 | Configure condition operator | _TBD_ | _TBD_ | <ul><li>⬜ Configure condition query operator (_TBD_)</li></ul> | 🔴 |
| 10C | 10.19 | Configure condition value | _TBD_ | _TBD_ | <ul><li>⬜ Configure condition query value (_TBD_)</li></ul> | 🔴 |
| 10C | 10.20 | Use placeholders | _TBD_ | _TBD_ | <ul><li>⬜ Use placeholders in conditions (${null}, ${currentUserId}, ${currentUserEmail}) (_TBD_)</li></ul> | 🔴 |
| **10D. Widget Config - Display** | 10.21 | Select display type | _TBD_ | _TBD_ | <ul><li>⬜ Select display type (Big number/Gauge) (_TBD_)</li></ul> | 🔴 |
| 10D | 10.22 | Configure display title | _TBD_ | _TBD_ | <ul><li>⬜ Configure display type title (_TBD_)</li></ul> | 🔴 |
| 10D | 10.23 | Configure display subtitle | _TBD_ | _TBD_ | <ul><li>⬜ Configure display type subtitle (_TBD_)</li></ul> | 🔴 |
| 10D | 10.24 | Configure display label | _TBD_ | _TBD_ | <ul><li>⬜ Configure display type label (_TBD_)</li></ul> | 🔴 |
| 10D | 10.25 | Toggle KPI usage | _TBD_ | _TBD_ | <ul><li>⬜ Toggle KPI usage (_TBD_)</li></ul> | 🔴 |
| 10D | 10.26 | Set URL path | _TBD_ | _TBD_ | <ul><li>⬜ Set URL path for widget click navigation (_TBD_)</li></ul> | 🔴 |
| **10E. Widget Types** | 10.27 | Configure Case count widget | _TBD_ | _TBD_ | <ul><li>⬜ Configure Case count widget (single case type count) (_TBD_)</li></ul> | 🔴 |
| 10E | 10.28 | Configure Multiple counts | _TBD_ | _TBD_ | <ul><li>⬜ Configure Multiple case counts widget (_TBD_)</li></ul> | 🔴 |
| 10E | 10.29 | Configure Group by widget | _TBD_ | _TBD_ | <ul><li>⬜ Configure Group by widget (_TBD_)</li></ul> | 🔴 |
| 10E | 10.30 | Configure Task count widget | _TBD_ | _TBD_ | <ul><li>⬜ Configure Task count widget (_TBD_)</li></ul> | 🔴 |

### Feature 11: Access Control Management 🟢

| Section | Function # | Function Name | Component | Path | Test Scenarios | Doc |
|---------|-----------|---------------|-----------|------|----------------|-----|
| **11A. Role Mgmt** | 11.1 | View roles list | _TBD_ | _TBD_ | <ul><li>⬜ Display list of roles (_TBD_)</li></ul> | 🔴 |
| 11A | 11.2 | Add new role | _TBD_ | _TBD_ | <ul><li>⬜ Add new role (_TBD_)</li></ul> | 🔴 |
| 11A | 11.3 | Enter role name | _TBD_ | _TBD_ | <ul><li>⬜ Enter role name (_TBD_)</li></ul> | 🔴 |
| 11A | 11.4 | Create role | _TBD_ | _TBD_ | <ul><li>⬜ Create role (_TBD_)</li></ul> | 🔴 |
| 11A | 11.5 | View role details | _TBD_ | _TBD_ | <ul><li>⬜ Select and view role details (_TBD_)</li></ul> | 🔴 |
| 11A | 11.6 | Edit role metadata | _TBD_ | _TBD_ | <ul><li>⬜ Edit role metadata (_TBD_)</li></ul> | 🔴 |
| 11A | 11.7 | Export role configuration | _TBD_ | _TBD_ | <ul><li>⬜ Export role configuration (_TBD_)</li></ul> | 🔴 |
| 11A | 11.8 | Delete role | _TBD_ | _TBD_ | <ul><li>⬜ Delete role (_TBD_)</li></ul> | 🔴 |
| **11B. Permissions** | 11.9 | View role permissions | _TBD_ | _TBD_ | <ul><li>⬜ View role permissions (JSON/visual toggle) (_TBD_)</li></ul> | 🔴 |
| 11B | 11.10 | Edit permissions JSON | _TBD_ | _TBD_ | <ul><li>⬜ Edit permissions in JSON format (_TBD_)</li></ul> | 🔴 |
| 11B | 11.11 | Configure resource permissions | _TBD_ | _TBD_ | <ul><li>⬜ Configure resource-level permissions (_TBD_)</li></ul> | 🔴 |
| 11B | 11.12 | Set permission conditions | _TBD_ | _TBD_ | <ul><li>⬜ Set permission conditions (_TBD_)</li></ul> | 🔴 |
| 11B | 11.13 | Save role permissions | _TBD_ | _TBD_ | <ul><li>⬜ Save role permissions (_TBD_)</li></ul> | 🔴 |

### Feature 12: Object Management 🟡

| Function # | Function Name | Component | Path | Test Scenarios | Doc |
|-----------|---------------|-----------|------|----------------|-----|
| 12.1 | Manage object types | _TBD_ | _TBD_ | <ul><li>⬜ Manage object types (_TBD_)</li></ul> | 🔴 |
| 12.2 | Edit object type configuration | _TBD_ | _TBD_ | <ul><li>⬜ Edit object type configuration (_TBD_)</li></ul> | 🔴 |

### Feature 13: Building Block Management 🟢

| Section | Function # | Function Name | Component | Path | Test Scenarios | Doc |
|---------|-----------|---------------|-----------|------|----------------|-----|
| **13A. BB Overview** | 13.1 | View building blocks list | _TBD_ | _TBD_ | <ul><li>⬜ Display list of building blocks (_TBD_)</li></ul> | 🔴 |
| 13A | 13.2 | View BB metadata | _TBD_ | _TBD_ | <ul><li>⬜ View building block name, key, and version (_TBD_)</li></ul> | 🔴 |
| 13A | 13.3 | Upload BB definition | _TBD_ | _TBD_ | <ul><li>⬜ Upload building block definition (ZIP, max 500kb) (_TBD_)</li></ul> | 🔴 |
| 13A | 13.4 | Acknowledge overwrite warning | _TBD_ | _TBD_ | <ul><li>⬜ Acknowledge overwrite warning for existing blocks (_TBD_)</li></ul> | 🔴 |
| 13A | 13.5 | Create new building block | _TBD_ | _TBD_ | <ul><li>⬜ Create new building block (_TBD_)</li></ul> | 🔴 |
| 13A | 13.6 | Enter BB name | _TBD_ | _TBD_ | <ul><li>⬜ Enter building block name (_TBD_)</li></ul> | 🔴 |
| 13A | 13.7 | Auto-generate BB key | _TBD_ | _TBD_ | <ul><li>⬜ Auto-generate building block key (_TBD_)</li></ul> | 🔴 |
| 13A | 13.8 | Enter BB version | _TBD_ | _TBD_ | <ul><li>⬜ Enter building block version (_TBD_)</li></ul> | 🔴 |
| 13A | 13.9 | Enter BB description | _TBD_ | _TBD_ | <ul><li>⬜ Enter building block description (_TBD_)</li></ul> | 🔴 |
| **13B. BB Details** | 13.10 | View BB general info | _TBD_ | _TBD_ | <ul><li>⬜ View building block general information (_TBD_)</li></ul> | 🔴 |
| 13B | 13.11 | View BB document tab | _TBD_ | _TBD_ | <ul><li>⬜ View building block document tab (_TBD_)</li></ul> | 🔴 |
| 13B | 13.12 | View BB processes tab | _TBD_ | _TBD_ | <ul><li>⬜ View building block processes tab (_TBD_)</li></ul> | 🔴 |
| 13B | 13.13 | View plugin configuration | _TBD_ | _TBD_ | <ul><li>⬜ View plugin configuration used (e.g., Zaak API) (_TBD_)</li></ul> | 🔴 |
| 13B | 13.14 | Upload/update BB artwork | _TBD_ | _TBD_ | <ul><li>⬜ Upload or update building block artwork (_TBD_)</li></ul> | 🔴 |
| 13B | 13.15 | Delete BB artwork | _TBD_ | _TBD_ | <ul><li>⬜ Delete building block artwork (_TBD_)</li></ul> | 🔴 |
| 13B | 13.16 | Save BB metadata | _TBD_ | _TBD_ | <ul><li>⬜ Save building block metadata (_TBD_)</li></ul> | 🔴 |
| 13B | 13.17 | Export BB as ZIP | _TBD_ | _TBD_ | <ul><li>⬜ Export building block as ZIP (_TBD_)</li></ul> | 🔴 |
| 13B | 13.18 | Create draft version | _TBD_ | _TBD_ | <ul><li>⬜ Create draft version (_TBD_)</li></ul> | 🔴 |
| 13B | 13.19 | Enter version tag | _TBD_ | _TBD_ | <ul><li>⬜ Enter new version tag for draft (_TBD_)</li></ul> | 🔴 |
| 13B | 13.20 | View version status badge | _TBD_ | _TBD_ | <ul><li>⬜ View version status badge (DRAFT/RELEASE) (_TBD_)</li></ul> | 🔴 |
| 13B | 13.21 | Switch versions | _TBD_ | _TBD_ | <ul><li>⬜ Switch between versions via dropdown (_TBD_)</li></ul> | 🔴 |
| 13B | 13.22 | Finalize draft version | _TBD_ | _TBD_ | <ul><li>⬜ Finalize draft version (convert DRAFT to RELEASE) (_TBD_)</li></ul> | 🔴 |
| **13C. BB Document** | 13.23 | View BB document structure | _TBD_ | _TBD_ | <ul><li>⬜ View building block document structure (JSON) (_TBD_)</li></ul> | 🔴 |
| 13C | 13.24 | Edit document structure | _TBD_ | _TBD_ | <ul><li>⬜ Edit document structure in JSON editor (_TBD_)</li></ul> | 🔴 |
| 13C | 13.25 | Manage required fields | _TBD_ | _TBD_ | <ul><li>⬜ Manage required fields with checkboxes (_TBD_)</li></ul> | 🔴 |
| 13C | 13.26 | View field types | _TBD_ | _TBD_ | <ul><li>⬜ View field types (string, object, array, boolean, etc.) (_TBD_)</li></ul> | 🔴 |
| 13C | 13.27 | View field descriptions | _TBD_ | _TBD_ | <ul><li>⬜ View field descriptions (_TBD_)</li></ul> | 🔴 |
| 13C | 13.28 | Search/filter fields | _TBD_ | _TBD_ | <ul><li>⬜ Search and filter document fields (_TBD_)</li></ul> | 🔴 |
| 13C | 13.29 | Save document config | _TBD_ | _TBD_ | <ul><li>⬜ Save document configuration (_TBD_)</li></ul> | 🔴 |
| **13D. BB Processes** | 13.30 | View processes list | _TBD_ | _TBD_ | <ul><li>⬜ View processes list in building block (_TBD_)</li></ul> | 🔴 |
| 13D | 13.31 | View process metadata | _TBD_ | _TBD_ | <ul><li>⬜ View process name and key (_TBD_)</li></ul> | 🔴 |
| 13D | 13.32 | Manage process definitions | _TBD_ | _TBD_ | <ul><li>⬜ Manage process definitions (_TBD_)</li></ul> | 🔴 |
| 13D | 13.33 | View process diagram | _TBD_ | _TBD_ | <ul><li>⬜ View process diagram/modeler (_TBD_)</li></ul> | 🔴 |
| 13D | 13.34 | Select process step | _TBD_ | _TBD_ | <ul><li>⬜ Select process step in diagram (_TBD_)</li></ul> | 🔴 |
| 13D | 13.35 | View step properties | _TBD_ | _TBD_ | <ul><li>⬜ View step properties panel (_TBD_)</li></ul> | 🔴 |
| 13D | 13.36 | Configure step settings | _TBD_ | _TBD_ | <ul><li>⬜ Configure step-specific settings (_TBD_)</li></ul> | 🔴 |
| 13D | 13.37 | Link steps to actions | _TBD_ | _TBD_ | <ul><li>⬜ Link process steps to building block actions (_TBD_)</li></ul> | 🔴 |
| 13D | 13.38 | Save process config | _TBD_ | _TBD_ | <ul><li>⬜ Save process configuration (_TBD_)</li></ul> | 🔴 |
| **13E. BB Plugin Integration** | 13.39 | View available plugins | _TBD_ | _TBD_ | <ul><li>⬜ View available process plugins (_TBD_)</li></ul> | 🔴 |
| 13E | 13.40 | Select plugin for step | _TBD_ | _TBD_ | <ul><li>⬜ Select plugin for process step (_TBD_)</li></ul> | 🔴 |
| 13E | 13.41 | Configure plugin properties | _TBD_ | _TBD_ | <ul><li>⬜ Configure plugin-specific properties (_TBD_)</li></ul> | 🔴 |
| 13E | 13.42 | View plugin requirements | _TBD_ | _TBD_ | <ul><li>⬜ View plugin requirements and descriptions (_TBD_)</li></ul> | 🔴 |
| 13E | 13.43 | Link action to plugin | _TBD_ | _TBD_ | <ul><li>⬜ Link action to plugin definition (_TBD_)</li></ul> | 🔴 |
| 13E | 13.44 | Configure execution properties | _TBD_ | _TBD_ | <ul><li>⬜ Configure execution properties for plugins (_TBD_)</li></ul> | 🔴 |
| 13E | 13.45 | View plugin warnings | _TBD_ | _TBD_ | <ul><li>⬜ View plugin configuration warnings (_TBD_)</li></ul> | 🔴 |

### Feature 14: Translation Management 🟢

| Section | Function # | Function Name | Component | Path | Test Scenarios | Doc |
|---------|-----------|---------------|-----------|------|----------------|-----|
| **14A. Translations** | 14.1 | View translations table | _TBD_ | _TBD_ | <ul><li>⬜ View translations table (_TBD_)</li></ul> | 🔴 |
| 14A | 14.2 | View translation keys | _TBD_ | _TBD_ | <ul><li>⬜ View translation keys column (_TBD_)</li></ul> | 🔴 |
| 14A | 14.3 | View language columns | _TBD_ | _TBD_ | <ul><li>⬜ View language columns (English, Nederlands) (_TBD_)</li></ul> | 🔴 |
| 14A | 14.4 | Add translation row | _TBD_ | _TBD_ | <ul><li>⬜ Add translation row (_TBD_)</li></ul> | 🔴 |
| 14A | 14.5 | Enter translation key | _TBD_ | _TBD_ | <ul><li>⬜ Enter translation key (_TBD_)</li></ul> | 🔴 |
| 14A | 14.6 | Enter English translation | _TBD_ | _TBD_ | <ul><li>⬜ Enter English translation (_TBD_)</li></ul> | 🔴 |
| 14A | 14.7 | Enter Dutch translation | _TBD_ | _TBD_ | <ul><li>⬜ Enter Dutch (Nederlands) translation (_TBD_)</li></ul> | 🔴 |
| 14A | 14.8 | Delete translation row | _TBD_ | _TBD_ | <ul><li>⬜ Delete translation row (_TBD_)</li></ul> | 🔴 |
| **14B. Save** | 14.9 | Save translations | _TBD_ | _TBD_ | <ul><li>⬜ Save translations (_TBD_)</li></ul> | 🔴 |
| 14B | 14.10 | Save and reload app | _TBD_ | _TBD_ | <ul><li>⬜ Save and reload application (_TBD_)</li></ul> | 🔴 |
| 14B | 14.11 | View save confirmation | _TBD_ | _TBD_ | <ul><li>⬜ View save confirmation dialog (_TBD_)</li></ul> | 🔴 |
| 14B | 14.12 | Cancel save operation | _TBD_ | _TBD_ | <ul><li>⬜ Cancel save operation (_TBD_)</li></ul> | 🔴 |

### Feature 15: IKO Management 🟢

| Section | Function # | Function Name | Component | Path | Test Scenarios | Doc |
|---------|-----------|---------------|-----------|------|----------------|-----|
| **15A. IKO Server** | 15.1 | View IKO servers list | _TBD_ | _TBD_ | <ul><li>⬜ View IKO servers list (_TBD_)</li></ul> | 🔴 |
| 15A | 15.2 | Configure IKO server | _TBD_ | _TBD_ | <ul><li>⬜ Configure IKO server (_TBD_)</li></ul> | 🔴 |
| 15A | 15.3 | Enter server title | _TBD_ | _TBD_ | <ul><li>⬜ Enter server title (_TBD_)</li></ul> | 🔴 |
| 15A | 15.4 | Auto-generate server key | _TBD_ | _TBD_ | <ul><li>⬜ Auto-generate server key (_TBD_)</li></ul> | 🔴 |
| 15A | 15.5 | Enter IKO server URL | _TBD_ | _TBD_ | <ul><li>⬜ Enter IKO server URL (_TBD_)</li></ul> | 🔴 |
| 15A | 15.6 | Save IKO server config | _TBD_ | _TBD_ | <ul><li>⬜ Save IKO server configuration (_TBD_)</li></ul> | 🔴 |
| 15A | 15.7 | Edit IKO server | _TBD_ | _TBD_ | <ul><li>⬜ Edit IKO server (_TBD_)</li></ul> | 🔴 |
| 15A | 15.8 | Delete IKO server | _TBD_ | _TBD_ | <ul><li>⬜ Delete IKO server (_TBD_)</li></ul> | 🔴 |
| 15A | 15.9 | View delete confirmation | _TBD_ | _TBD_ | <ul><li>⬜ View delete confirmation dialog (_TBD_)</li></ul> | 🔴 |
| 15A | 15.10 | Import IKO definition | _TBD_ | _TBD_ | <ul><li>⬜ Import IKO definition (ZIP, max 500kb) (_TBD_)</li></ul> | 🔴 |
| 15A | 15.11 | Select file for import | _TBD_ | _TBD_ | <ul><li>⬜ Select file for import (_TBD_)</li></ul> | 🔴 |
| 15A | 15.12 | Cancel import | _TBD_ | _TBD_ | <ul><li>⬜ Cancel import (_TBD_)</li></ul> | 🔴 |
| **15B. View Mgmt** | 15.13 | View IKO views list | _TBD_ | _TBD_ | <ul><li>⬜ View IKO views list (_TBD_)</li></ul> | 🔴 |
| 15B | 15.14 | Add view | _TBD_ | _TBD_ | <ul><li>⬜ Add view (_TBD_)</li></ul> | 🔴 |
| 15B | 15.15 | Enter view title | _TBD_ | _TBD_ | <ul><li>⬜ Enter view title (_TBD_)</li></ul> | 🔴 |
| 15B | 15.16 | Auto-generate view key | _TBD_ | _TBD_ | <ul><li>⬜ Auto-generate view key (_TBD_)</li></ul> | 🔴 |
| 15B | 15.17 | Enter connector reference | _TBD_ | _TBD_ | <ul><li>⬜ Enter connector reference (_TBD_)</li></ul> | 🔴 |
| 15B | 15.18 | Enter connector instance ref | _TBD_ | _TBD_ | <ul><li>⬜ Enter connector instance reference (_TBD_)</li></ul> | 🔴 |
| 15B | 15.19 | Enter endpoint reference | _TBD_ | _TBD_ | <ul><li>⬜ Enter endpoint reference (_TBD_)</li></ul> | 🔴 |
| 15B | 15.20 | Add key value pairs | _TBD_ | _TBD_ | <ul><li>⬜ Add key value pairs (_TBD_)</li></ul> | 🔴 |
| 15B | 15.21 | Save view | _TBD_ | _TBD_ | <ul><li>⬜ Save view (_TBD_)</li></ul> | 🔴 |
| 15B | 15.22 | Edit view | _TBD_ | _TBD_ | <ul><li>⬜ Edit view (_TBD_)</li></ul> | 🔴 |
| 15B | 15.23 | Delete view | _TBD_ | _TBD_ | <ul><li>⬜ Delete view (_TBD_)</li></ul> | 🔴 |
| **15C. Search Actions** | 15.24 | View search actions tab | _TBD_ | _TBD_ | <ul><li>⬜ View search actions tab (_TBD_)</li></ul> | 🔴 |
| 15C | 15.25 | View search actions list | _TBD_ | _TBD_ | <ul><li>⬜ View search actions list (_TBD_)</li></ul> | 🔴 |
| 15C | 15.26 | Add search action | _TBD_ | _TBD_ | <ul><li>⬜ Add search action (_TBD_)</li></ul> | 🔴 |
| 15C | 15.27 | Enter search action title | _TBD_ | _TBD_ | <ul><li>⬜ Enter search action title (_TBD_)</li></ul> | 🔴 |
| 15C | 15.28 | Enter search action key | _TBD_ | _TBD_ | <ul><li>⬜ Enter search action key (_TBD_)</li></ul> | 🔴 |
| 15C | 15.29 | Delete search action | _TBD_ | _TBD_ | <ul><li>⬜ Delete search action (_TBD_)</li></ul> | 🔴 |
| 15C | 15.30 | View search action details | _TBD_ | _TBD_ | <ul><li>⬜ View search action details (_TBD_)</li></ul> | 🔴 |
| **15D. Search Fields** | 15.31 | View search fields list | _TBD_ | _TBD_ | <ul><li>⬜ View search fields list (_TBD_)</li></ul> | 🔴 |
| 15D | 15.32 | Add search field | _TBD_ | _TBD_ | <ul><li>⬜ Add search field (_TBD_)</li></ul> | 🔴 |
| 15D | 15.33 | Enter field title | _TBD_ | _TBD_ | <ul><li>⬜ Enter field title (e.g., "BSN") (_TBD_)</li></ul> | 🔴 |
| 15D | 15.34 | Enter field key | _TBD_ | _TBD_ | <ul><li>⬜ Enter field key (e.g., "bsn") (_TBD_)</li></ul> | 🔴 |
| 15D | 15.35 | Enter field path | _TBD_ | _TBD_ | <ul><li>⬜ Enter field path (e.g., "burgerservicenummer") (_TBD_)</li></ul> | 🔴 |
| 15D | 15.36 | Select data type | _TBD_ | _TBD_ | <ul><li>⬜ Select data type dropdown (Text) (_TBD_)</li></ul> | 🔴 |
| 15D | 15.37 | Select match type | _TBD_ | _TBD_ | <ul><li>⬜ Select match type (Exact) (_TBD_)</li></ul> | 🔴 |
| 15D | 15.38 | Select field type | _TBD_ | _TBD_ | <ul><li>⬜ Select field type (Single) (_TBD_)</li></ul> | 🔴 |
| 15D | 15.39 | Set field as required | _TBD_ | _TBD_ | <ul><li>⬜ Set field as required (toggle) (_TBD_)</li></ul> | 🔴 |
| 15D | 15.40 | Save search field | _TBD_ | _TBD_ | <ul><li>⬜ Save search field (_TBD_)</li></ul> | 🔴 |
| 15D | 15.41 | Edit search field | _TBD_ | _TBD_ | <ul><li>⬜ Edit search field (_TBD_)</li></ul> | 🔴 |
| 15D | 15.42 | Delete search field | _TBD_ | _TBD_ | <ul><li>⬜ Delete search field (_TBD_)</li></ul> | 🔴 |
| **15E. List Columns** | 15.43 | View list tab | _TBD_ | _TBD_ | <ul><li>⬜ View list tab (_TBD_)</li></ul> | 🔴 |
| 15E | 15.44 | View list columns | _TBD_ | _TBD_ | <ul><li>⬜ View list columns (Title, Key, Path, Display Type, etc.) (_TBD_)</li></ul> | 🔴 |
| 15E | 15.45 | Add column | _TBD_ | _TBD_ | <ul><li>⬜ Add column (_TBD_)</li></ul> | 🔴 |
| 15E | 15.46 | Enter column title | _TBD_ | _TBD_ | <ul><li>⬜ Enter column title (_TBD_)</li></ul> | 🔴 |
| 15E | 15.47 | Auto-generate column key | _TBD_ | _TBD_ | <ul><li>⬜ Auto-generate column key (_TBD_)</li></ul> | 🔴 |
| 15E | 15.48 | Enter column path | _TBD_ | _TBD_ | <ul><li>⬜ Enter column path (e.g., "/basisgegevens/bsn") (_TBD_)</li></ul> | 🔴 |
| 15E | 15.49 | Toggle sorting enabled | _TBD_ | _TBD_ | <ul><li>⬜ Toggle sorting enabled (_TBD_)</li></ul> | 🔴 |
| 15E | 15.50 | Select default sort | _TBD_ | _TBD_ | <ul><li>⬜ Select default sort (_TBD_)</li></ul> | 🔴 |
| 15E | 15.51 | Select display type | _TBD_ | _TBD_ | <ul><li>⬜ Select display type (hidden, Text) (_TBD_)</li></ul> | 🔴 |
| 15E | 15.52 | Save column | _TBD_ | _TBD_ | <ul><li>⬜ Save column (_TBD_)</li></ul> | 🔴 |
| 15E | 15.53 | Edit column | _TBD_ | _TBD_ | <ul><li>⬜ Edit column (_TBD_)</li></ul> | 🔴 |
| 15E | 15.54 | Reorder columns | _TBD_ | _TBD_ | <ul><li>⬜ Reorder columns (drag handle) (_TBD_)</li></ul> | 🔴 |
| **15F. Tabs** | 15.55 | View tabs tab | _TBD_ | _TBD_ | <ul><li>⬜ View tabs tab (_TBD_)</li></ul> | 🔴 |
| 15F | 15.56 | View tabs list | _TBD_ | _TBD_ | <ul><li>⬜ View tabs list (Key, Tab title, Tab type, Properties) (_TBD_)</li></ul> | 🔴 |
| 15F | 15.57 | Add tab | _TBD_ | _TBD_ | <ul><li>⬜ Add tab (_TBD_)</li></ul> | 🔴 |
| 15F | 15.58 | Enter tab title | _TBD_ | _TBD_ | <ul><li>⬜ Enter tab title (_TBD_)</li></ul> | 🔴 |
| 15F | 15.59 | Auto-generate tab key | _TBD_ | _TBD_ | <ul><li>⬜ Auto-generate tab key (_TBD_)</li></ul> | 🔴 |
| 15F | 15.60 | Select tab type | _TBD_ | _TBD_ | <ul><li>⬜ Select tab type dropdown (_TBD_)</li></ul> | 🔴 |
| 15F | 15.61 | Enter data profile name | _TBD_ | _TBD_ | <ul><li>⬜ Enter aggregated data profile name (optional) (_TBD_)</li></ul> | 🔴 |
| 15F | 15.62 | Save tab | _TBD_ | _TBD_ | <ul><li>⬜ Save tab (_TBD_)</li></ul> | 🔴 |
| 15F | 15.63 | Edit tab | _TBD_ | _TBD_ | <ul><li>⬜ Edit tab (_TBD_)</li></ul> | 🔴 |
| 15F | 15.64 | Delete tab | _TBD_ | _TBD_ | <ul><li>⬜ Delete tab (_TBD_)</li></ul> | 🔴 |
| **15G. IKO Widgets** | 15.65 | View widget details page | _TBD_ | _TBD_ | <ul><li>⬜ View IKO widget details page (_TBD_)</li></ul> | 🔴 |
| 15G | 15.66 | View widgets list | _TBD_ | _TBD_ | <ul><li>⬜ View widgets list (_TBD_)</li></ul> | 🔴 |
| 15G | 15.67 | View widget properties | _TBD_ | _TBD_ | <ul><li>⬜ View widget properties (Title, Type, Key, Width, Density, High contrast) (_TBD_)</li></ul> | 🔴 |
| 15G | 15.68 | Toggle visual/JSON editor | _TBD_ | _TBD_ | <ul><li>⬜ Toggle visual/JSON editor (_TBD_)</li></ul> | 🔴 |
| 15G | 15.69 | Edit widgets JSON | _TBD_ | _TBD_ | <ul><li>⬜ Edit widgets in JSON editor (_TBD_)</li></ul> | 🔴 |
| 15G | 15.70 | Add widget divider | _TBD_ | _TBD_ | <ul><li>⬜ Add widget divider (_TBD_)</li></ul> | 🔴 |
| 15G | 15.71 | Enter divider title | _TBD_ | _TBD_ | <ul><li>⬜ Enter divider title (optional) (_TBD_)</li></ul> | 🔴 |
| 15G | 15.72 | Auto-generate divider key | _TBD_ | _TBD_ | <ul><li>⬜ Auto-generate divider key (_TBD_)</li></ul> | 🔴 |
| 15G | 15.73 | Create widget | _TBD_ | _TBD_ | <ul><li>⬜ Create widget (_TBD_)</li></ul> | 🔴 |
| 15G | 15.74 | Choose widget type | _TBD_ | _TBD_ | <ul><li>⬜ Choose widget type (Fields, Table, Interactive table, Collection, Map) (_TBD_)</li></ul> | 🔴 |
| 15G | 15.75 | Save widget configuration | _TBD_ | _TBD_ | <ul><li>⬜ Save widget configuration (_TBD_)</li></ul> | 🔴 |

### Feature 16: Choice Fields Management 🟡

| Function # | Function Name | Component | Path | Test Scenarios | Doc |
|-----------|---------------|-----------|------|----------------|-----|
| 16.1 | Manage choice field definitions | _TBD_ | _TBD_ | <ul><li>⬜ Manage choice field definitions (_TBD_)</li></ul> | 🔴 |
| 16.2 | Add/edit/delete choice options | _TBD_ | _TBD_ | <ul><li>⬜ Add/edit/delete choice field options (_TBD_)</li></ul> | 🔴 |

### Feature 17: Failed Notifications 🟡

| Function # | Function Name | Component | Path | Test Scenarios | Doc |
|-----------|---------------|-----------|------|----------------|-----|
| 17.1 | View failed notifications | _TBD_ | _TBD_ | <ul><li>⬜ View failed notifications (_TBD_)</li></ul> | 🔴 |
| 17.2 | Retry notification | _TBD_ | _TBD_ | <ul><li>⬜ Retry failed notification (_TBD_)</li></ul> | 🔴 |
| 17.3 | Delete notification | _TBD_ | _TBD_ | <ul><li>⬜ Delete notification (_TBD_)</li></ul> | 🔴 |

### Feature 18: Logs 🟡

| Function # | Function Name | Component | Path | Test Scenarios | Doc |
|-----------|---------------|-----------|------|----------------|-----|
| 18.1 | View application logs | _TBD_ | _TBD_ | <ul><li>⬜ View application logs (_TBD_)</li></ul> | 🔴 |
| 18.2 | Filter/search logs | _TBD_ | _TBD_ | <ul><li>⬜ Filter and search logs (_TBD_)</li></ul> | 🔴 |

### Feature 19: Case Migration (Beta) 🟡

| Function # | Function Name | Component | Path | Test Scenarios | Doc |
|-----------|---------------|-----------|------|----------------|-----|
| 19.1 | Migrate cases | _TBD_ | _TBD_ | <ul><li>⬜ Migrate cases between versions (_TBD_)</li></ul> | 🔴 |
| 19.2 | View migration status | _TBD_ | _TBD_ | <ul><li>⬜ View migration status (_TBD_)</li></ul> | 🔴 |

### Feature 20: Process Migration 🟡

| Function # | Function Name | Component | Path | Test Scenarios | Doc |
|-----------|---------------|-----------|------|----------------|-----|
| 20.1 | Migrate process instances | _TBD_ | _TBD_ | <ul><li>⬜ Migrate process instances (_TBD_)</li></ul> | 🔴 |
| 20.2 | View migration status | _TBD_ | _TBD_ | <ul><li>⬜ View migration status (_TBD_)</li></ul> | 🔴 |

### Feature 21: Team Management 🟢

| Section | Function # | Function Name | Component | Path | Test Scenarios | Doc |
|---------|-----------|---------------|-----------|------|----------------|-----|
| **21A. Overview** | 21.1 | View teams list | _TBD_ | `/teams` | <ul><li>⬜ Display list of all teams (_TBD_)</li></ul> | 🟢 |
| 21A | 21.2 | Create new team | _TBD_ | `/teams` | <ul><li>⬜ Create a new team with key and title (_TBD_)</li></ul> | 🟢 |
| **21B. Details** | 21.3 | View team details | _TBD_ | `/teams/:teamKey` | <ul><li>⬜ Display team key and title (_TBD_)</li></ul> | 🟢 |
| 21B | 21.4 | Edit team details | _TBD_ | `/teams/:teamKey` | <ul><li>⬜ Update team title (_TBD_)</li></ul> | 🟢 |
| 21B | 21.5 | Delete team | _TBD_ | `/teams/:teamKey` | <ul><li>⬜ Delete a team (_TBD_)</li></ul> | 🟢 |
| **21C. Members** | 21.6 | View team members | _TBD_ | `/teams/:teamKey` | <ul><li>⬜ Display list of users in the team (_TBD_)</li></ul> | 🟢 |
| 21C | 21.7 | Add member to team | _TBD_ | `/teams/:teamKey` | <ul><li>⬜ Search and add a user to the team (_TBD_)</li></ul> | 🟢 |
| 21C | 21.8 | Remove member from team | _TBD_ | `/teams/:teamKey` | <ul><li>⬜ Remove a user from the team (_TBD_)</li></ul> | 🟢 |

---

## Total Count

| Metric | Number |
|--------|--------|
| **Total Features** | 21 |
| **Total Functions** | 357 |
| **Documented Functions (🟢)** | 326 (Features 6, 9, 10, 11, 13, 14, 15, 21) |
| **Functions to document (🟡🔴)** | 31 |

---

- [ ] Process Cases (User) screenshots
- [ ] Other admin features screenshots (if needed)

---

*Last updated: March 12, 2026*
