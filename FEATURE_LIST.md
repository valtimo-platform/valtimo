# Valtimo Frontend Feature & Function List

**Purpose:** Countable list of features and functions for KPI tracking, E2E test planning and documentation.

**Legend:**
- **Feature** = High-level capability (e.g. "Case Definition Management")
- **Function** = Specific action/operation within a feature (e.g. "Create Process")

**Status:** 🟢 Documented with screenshots | 🟡 Identified, no screenshots | 🔴 Yet to process

---

## Summary

| Category | Number of Features | Number of Functions |
|----------|-------------------|-------------------|
| User Features | 5 | 21 |
| Admin Features | 15 | 328 |
| **Total** | **20** | **349** |

---

## User Features (ROLE_USER)

### Feature 1: Dashboard 🟡

- 1.1. Display widget-based dashboard
- 1.2. Configure widgets per user/role
- 1.3. Real-time data updates (SSE)

### Feature 2: Cases (User) 🔴

- 2.1. View cases overview per definition
- 2.2. View case details (tabs)
- 2.3. Search/filter cases
- 2.4. View case documents
- 2.5. View case progress/status
- 2.6. Execute tasks within case

### Feature 3: Tasks 🟡

- 3.1. View all open tasks
- 3.2. Filter/sort tasks
- 3.3. View task details
- 3.4. Claim task
- 3.5. Execute task (fill form)
- 3.6. Complete task

### Feature 4: Objects 🟡

- 4.1. View objects per type
- 4.2. View object details
- 4.3. Search/filter objects

### Feature 5: Views / Images (IKO User) 🟡

- 5.1. Search IKO objects
- 5.2. View search results
- 5.3. View IKO object details

---

## Admin Features (ROLE_ADMIN)

### Feature 6: Case Definition Management 🟢

**6A. General tab**

- 6.1. Link upload process to case
- 6.2. Set case handler toggle
- 6.3. Set auto-assign tasks to case handler toggle
- 6.4. Set external start form toggle
- 6.5. Enter external start form URL

**6B. Processes tab**

- 6.6. View linked processes
- 6.7. Create new process
- 6.8. Open process in BPMN modeler
- 6.9. Add BPMN elements via drag-drop
- 6.10. Set process properties (Starts case, Startable by user)
- 6.11. Save process

**6C. Process Links**

- 6.12. Create process link (wizard)
- 6.13. Configure Form link type
- 6.14. Configure FormFlow link type
- 6.15. Configure Plugin link type
- 6.16. Configure plugin action
- 6.17. Configure Building block link type
- 6.18. Select building block from available list
- 6.19. View building block descriptions with artwork
- 6.20. Select building block version
- 6.21. Configure plugin mapping for building block
- 6.22. Configure input mapping (building block to case)
- 6.23. Add input field mapping
- 6.24. Select source path from building block document
- 6.25. Map to target case field (dropdown)
- 6.26. Toggle dropdown/manual input for mapping
- 6.27. Mark input fields as required
- 6.28. Configure sync mapping (case to building block)
- 6.29. Add sync field mapping
- 6.30. Select source field from case
- 6.31. Map to target building block field
- 6.32. Delete input/sync mappings
- 6.33. View dependency warnings (push config needed)
- 6.34. Complete building block configuration
- 6.35. Save process link

**6D. Version Management**

- 6.36. Select version
- 6.37. View all versions
- 6.38. Manage version

**6E. Decision Tables tab**

- 6.39. View linked decision tables
- 6.40. Upload decision table (.dmn)
- 6.41. Open decision table in DMN editor
- 6.42. Set DMN Hit policy
- 6.43. Manage DMN input/output columns
- 6.44. Add/edit/delete DMN rules
- 6.45. Save decision table

**6F. Document tab**

- 6.46. View JSON Schema definition
- 6.47. Download JSON Schema
- 6.48. Edit JSON Schema
- 6.49. Save JSON Schema

**6G. Forms tab**

- 6.50. View forms list
- 6.51. Search/filter forms
- 6.52. Create form
- 6.53. Form.io builder - add components (drag-drop)
- 6.54. Form.io builder - configure component
- 6.55. Use Form.io JSON editor
- 6.56. View form preview
- 6.57. Save form

**6H. Form Flows tab**

- 6.58. View form flows list
- 6.59. Create form flow
- 6.60. Edit form flow JSON
- 6.61. Save form flow

**6I. Tasks tab**

- 6.62. View task list columns
- 6.63. Add task list column
- 6.64. Rearrange task list columns
- 6.65. View task list search fields
- 6.66. Add task list search field
- 6.67. Toggle task list JSON/table view

**6J. Case List tab**

- 6.68. View case list columns
- 6.69. Add case list column
- 6.70. Rearrange case list columns
- 6.71. View case list search fields
- 6.72. Add case list search field
- 6.73. Download case list configuration

**6K. Case Details tab - Tabs**

- 6.74. View tabs
- 6.75. Add tab (Standard/FormIO/Custom/Widgets)
- 6.76. Rearrange tabs

**6L. Case Details tab - Statuses**

- 6.77. View statuses
- 6.78. Add status
- 6.79. Set status color
- 6.80. Set status visibility
- 6.81. Rearrange statuses

**6M. Case Details tab - Tags**

- 6.82. View tags
- 6.83. Add tag
- 6.84. Set tag color

**6N. Case Details tab - Header Widgets**

- 6.85. View header widgets
- 6.86. Add header widget

**6O. Case Details tab - Widgets**

- 6.87. View widgets list
- 6.88. Add widget (6-step wizard)
- 6.89. Select widget type (Fields/Custom component/Form.io/Table/Collection/Map)
- 6.90. Set widget width
- 6.91. Set widget density
- 6.92. Set widget style
- 6.93. Configure widget content
- 6.94. Set widget display conditions
- 6.95. Add widget separator
- 6.96. Rearrange widgets
- 6.97. Use widget JSON editor

**6P. ZGW tab - General**

- 6.98. Configure case details synchronization
- 6.99. Link case type
- 6.100. Edit case type
- 6.101. Delete case type

**6Q. ZGW tab - Document columns**

- 6.102. View document columns
- 6.103. Add document column
- 6.104. Set document column sorting
- 6.105. Rearrange document columns

**6R. ZGW tab - Document upload fields**

- 6.106. View upload fields
- 6.107. Set upload field visibility
- 6.108. Set upload field default value

**6S. ZGW tab - Document keywords**

- 6.109. View keywords
- 6.110. Add keyword
- 6.111. Search keywords

---

### Feature 7: Process Management 🟡

- 7.1. View process overview
- 7.2. Create new process
- 7.3. Edit BPMN process
- 7.4. Deploy process
- 7.5. Manage process versions

### Feature 8: Decision Table Management 🟡

- 8.1. View decision tables overview
- 8.2. Create decision table
- 8.3. Edit decision table (DMN modeler)
- 8.4. Test decision table

### Feature 9: Plugin Management 🟢

**9A. Plugin Overview**

- 9.1. View plugin configurations list
- 9.2. View plugin configuration name
- 9.3. View plugin name (API type)
- 9.4. View plugin identifier
- 9.5. Browse available plugins
- 9.6. View plugin categories (Zaak API, Catalog API, Documenten API, etc.)
- 9.7. View plugin descriptions with logos
- 9.8. Filter/search plugins

**9B. Create Plugin Configuration**

- 9.9. Configure plugin (2-step wizard)
- 9.10. Choose plugin type from catalog
- 9.11. Enter plugin data (step 2)
- 9.12. Auto-generate configuration ID (UUID)
- 9.13. Enter configuration name (required)
- 9.14. Enter RSIN (required for some plugins)
- 9.15. Enter plugin API URL (required)
- 9.16. Select authentication plugin configuration (required)
- 9.17. View available authentication options dropdown
- 9.18. Save plugin configuration
- 9.19. Cancel plugin configuration

**9C. Edit Plugin Configuration**

- 9.20. Open existing plugin configuration
- 9.21. View configuration ID (read-only UUID)
- 9.22. Edit configuration name
- 9.23. Edit RSIN
- 9.24. Edit API URL
- 9.25. Change authentication plugin
- 9.26. Save configuration changes
- 9.27. Delete plugin configuration

### Feature 10: Dashboard Management 🟢

**10A. Dashboard Configuration**

- 10.1. View dashboard list
- 10.2. Create dashboard
- 10.3. Edit dashboard
- 10.4. View dashboard metadata (created by, created on, dashboard key)
- 10.5. Toggle JSON/visual editor
- 10.6. Edit dashboard JSON directly

**10B. Widget Management**

- 10.7. View widgets list
- 10.8. Add new widget
- 10.9. Rearrange widgets (drag-drop)
- 10.10. Delete widget
- 10.11. Edit widget configuration

**10C. Widget Configuration - Data Source**

- 10.12. Select widget type (Case count/Multiple case counts/Group by/Task count)
- 10.13. Enter widget title
- 10.14. Select data source (Case count/Case counts/Task count)
- 10.15. Select case type (for case count widgets)
- 10.16. Add conditions to filter data
- 10.17. Configure condition query path
- 10.18. Configure condition query operator
- 10.19. Configure condition query value
- 10.20. Use placeholders in conditions (${null}, ${currentUserId}, ${currentUserEmail})

**10D. Widget Configuration - Display**

- 10.21. Select display type (Big number/Gauge)
- 10.22. Configure display type title
- 10.23. Configure display type subtitle
- 10.24. Configure display type label
- 10.25. Toggle KPI usage
- 10.26. Set URL path for widget click navigation

**10E. Widget Types**

- 10.27. Configure Case count widget (single case type count)
- 10.28. Configure Multiple case counts widget
- 10.29. Configure Group by widget
- 10.30. Configure Task count widget

### Feature 11: Access Control Management 🟢

**11A. Role Management**

- 11.1. View roles list
- 11.2. Add new role
- 11.3. Enter role name
- 11.4. Create role
- 11.5. Select/view role details
- 11.6. Edit role metadata
- 11.7. Export role configuration
- 11.8. Delete role

**11B. Permission Configuration**

- 11.9. View role permissions (JSON/visual toggle)
- 11.10. Edit permissions in JSON format
- 11.11. Configure resource-level permissions
- 11.12. Set permission conditions
- 11.13. Save role permissions

### Feature 12: Object Management 🟡

- 12.1. Manage object types
- 12.2. Edit object type configuration

### Feature 13: Building Block Management 🟢

**13A. Building Block Overview**

- 13.1. View building blocks list
- 13.2. View building block name, key, and version
- 13.3. Upload building block definition (ZIP, max 500kb)
- 13.4. Acknowledge overwrite warning for existing blocks
- 13.5. Create new building block
- 13.6. Enter building block name
- 13.7. Auto-generate building block key
- 13.8. Enter building block version
- 13.9. Enter building block description

**13B. Building Block Details**

- 13.10. View building block general information
- 13.11. View building block document tab
- 13.12. View building block processes tab
- 13.13. View plugin configuration used (e.g., Zaak API)
- 13.14. Upload/update building block artwork
- 13.15. Delete building block artwork
- 13.16. Save building block metadata
- 13.17. Export building block as ZIP
- 13.18. Create draft version
- 13.19. Enter new version tag for draft
- 13.20. View version status badge (DRAFT/RELEASE)
- 13.21. Switch between versions via dropdown
- 13.22. Finalize draft version (convert DRAFT to RELEASE)

**13C. Building Block Document Configuration**

- 13.23. View building block document structure (JSON)
- 13.24. Edit document structure in JSON editor
- 13.25. Manage required fields with checkboxes
- 13.26. View field types (string, object, array, boolean, etc.)
- 13.27. View field descriptions
- 13.28. Search/filter document fields
- 13.29. Save document configuration

**13D. Building Block Process Management**

- 13.30. View processes list in building block
- 13.31. View process name and key
- 13.32. Manage process definitions
- 13.33. View process diagram/modeler
- 13.34. Select process step in diagram
- 13.35. View step properties panel
- 13.36. Configure step-specific settings
- 13.37. Link process steps to building block actions
- 13.38. Save process configuration

**13E. Building Block Plugin Integration**

- 13.39. View available process plugins
- 13.40. Select plugin for process step (Beoordeel Geschiktheid)
- 13.41. Configure plugin-specific properties
- 13.42. View plugin requirements and descriptions
- 13.43. Link action to plugin definition
- 13.44. Configure execution properties for plugins
- 13.45. View plugin configuration warnings

### Feature 14: Translation Management 🟢

**14A. Translation Overview**

- 14.1. View translations table
- 14.2. View translation keys column
- 14.3. View language columns (English, Nederlands)
- 14.4. Add translation row
- 14.5. Enter translation key
- 14.6. Enter English translation
- 14.7. Enter Dutch (Nederlands) translation
- 14.8. Delete translation row

**14B. Save Translations**

- 14.9. Save translations
- 14.10. Save and reload application
- 14.11. View save confirmation dialog
- 14.12. Cancel save operation

### Feature 15: IKO Management 🟢

**15A. IKO Server Management**

- 15.1. View IKO servers list
- 15.2. Configure IKO server
- 15.3. Enter server title
- 15.4. Auto-generate server key
- 15.5. Enter IKO server URL
- 15.6. Save IKO server configuration
- 15.7. Edit IKO server
- 15.8. Delete IKO server
- 15.9. View delete confirmation dialog
- 15.10. Import IKO definition (ZIP, max 500kb)
- 15.11. Select file for import
- 15.12. Cancel import

**15B. View Management**

- 15.13. View IKO views list
- 15.14. Add view
- 15.15. Enter view title
- 15.16. Auto-generate view key
- 15.17. Enter connector reference
- 15.18. Enter connector instance reference
- 15.19. Enter endpoint reference
- 15.20. Add key value pairs
- 15.21. Save view
- 15.22. Edit view
- 15.23. Delete view

**15C. Search Actions Management**

- 15.24. View search actions tab
- 15.25. View search actions list
- 15.26. Add search action
- 15.27. Enter search action title
- 15.28. Enter search action key
- 15.29. Delete search action
- 15.30. View search action details

**15D. Search Fields Configuration**

- 15.31. View search fields list
- 15.32. Add search field
- 15.33. Enter field title (e.g., "BSN")
- 15.34. Enter field key (e.g., "bsn")
- 15.35. Enter field path (e.g., "burgerservicenummer")
- 15.36. Select data type dropdown (Text)
- 15.37. Select match type (Exact)
- 15.38. Select field type (Single)
- 15.39. Set field as required (toggle)
- 15.40. Save search field
- 15.41. Edit search field
- 15.42. Delete search field

**15E. List Columns Configuration**

- 15.43. View list tab
- 15.44. View list columns (Title, Key, Path, Display Type, Parameters, Sortable, Default Sort)
- 15.45. Add column
- 15.46. Enter column title (e.g., "Burgerservicenummer", "Naam", "Adres", "Geboortedatum")
- 15.47. Auto-generate column key
- 15.48. Enter column path (e.g., "/basisgegevens/bsn")
- 15.49. Toggle sorting enabled
- 15.50. Select default sort
- 15.51. Select display type (hidden, Text)
- 15.52. Save column
- 15.53. Edit column
- 15.54. Reorder columns (drag handle)

**15F. Tabs Configuration**

- 15.55. View tabs tab
- 15.56. View tabs list (Key, Tab title, Tab type, Properties)
- 15.57. Add tab
- 15.58. Enter tab title
- 15.59. Auto-generate tab key
- 15.60. Select tab type dropdown
- 15.61. Enter aggregated data profile name (optional)
- 15.62. Save tab
- 15.63. Edit tab
- 15.64. Delete tab

**15G. IKO Widget Details**

- 15.65. View IKO widget details page
- 15.66. View widgets list (Basisgegevens, Inkomsten, Gezinssituatie, Zaken, Contactmomenten, Werk, Gezin, Toeslagen, Atlas)
- 15.67. View widget properties (Title, Type, Key, Width, Density, High contrast)
- 15.68. Toggle visual/JSON editor
- 15.69. Edit widgets in JSON editor
- 15.70. Add widget divider
- 15.71. Enter divider title (optional)
- 15.72. Auto-generate divider key
- 15.73. Create widget
- 15.74. Choose widget type (Fields, Table, Interactive table, Collection, Map)
- 15.75. Save widget configuration

### Feature 16: Choice Fields Management 🟡

- 16.1. Manage choice field definitions
- 16.2. Add/edit/delete choice field options

### Feature 17: Failed Notifications 🟡

- 17.1. View failed notifications
- 17.2. Retry notification
- 17.3. Delete notification

### Feature 18: Logs 🟡

- 18.1. View application logs
- 18.2. Filter/search logs

### Feature 19: Case Migration (Beta) 🟡

- 19.1. Migrate cases between versions
- 19.2. View migration status

### Feature 20: Process Migration 🟡

- 20.1. Migrate process instances
- 20.2. View migration status

---

## Total Count

| Metric | Number |
|--------|--------|
| **Total Features** | 20 |
| **Total Functions** | 349 |
| **Documented Functions (🟢)** | 318 (Features 6, 9, 10, 11, 13, 14, 15) |
| **Functions to document (🟡🔴)** | 31 |

---

## Yet to process

- [ ] Process Cases (User) screenshots
- [ ] Other admin features screenshots (if needed)

---

*Last updated: February 10, 2026*
