# Valtimo Frontend Feature Overview

This document contains an overview of all frontend features in Valtimo, intended for creating E2E tests and documentation.

**Last updated:** January 29, 2026
**Status:** Work in progress - being extended with screenshots

---

## Table of Contents

1. [User Features (ROLE_USER)](#1-user-features-role_user)
2. [Admin Features (ROLE_ADMIN)](#2-admin-features-role_admin)
3. [Shared Components](#3-shared-components)
4. [E2E Test Scenarios](#5-e2e-test-scenarios)

---

## 1. User Features (ROLE_USER)

### 1.1 Dashboard
**Module:** `@valtimo/dashboard`
**Route:** `/`

**Functionality:**
- [ ] Display widget-based dashboard
- [ ] Configurable widgets per user/role
- [ ] Real-time data updates (SSE)

---

### 1.2 Cases
**Module:** `@valtimo/case`
**Routes:**
- `/cases/:caseDefinitionKey` - Case list
- `/cases/:caseDefinitionKey/document/:documentId` - Case details
- `/cases/:caseDefinitionKey/document/:documentId/:tab` - Case details with specific tab
- `/cases/:caseDefinitionKey/document/:documentId/:tab/tasks/:taskId` - Task details within case

**Functionality:**
- [ ] View cases overview per definition
- [ ] View case details (tabs)
- [ ] Search/filter cases
- [ ] View case documents
- [ ] View case progress/status
- [ ] Execute tasks within case

**Screenshots:** _Waiting for screenshots_

---

### 1.3 Tasks
**Module:** `@valtimo/task`
**Route:** `/tasks`

**Functionality:**
- [ ] View all open tasks
- [ ] Filter/sort tasks
- [ ] View task details
- [ ] Claim task
- [ ] Execute task (fill in form)
- [ ] Complete task

---

### 1.4 Objects
**Module:** `@valtimo/object`
**Routes:**
- `/objects/:objectManagementId` - Object list
- `/objects/:objectManagementId/:objectId` - Object details

**Functionality:**
- [ ] View objects per type
- [ ] View object details
- [ ] Search/filter objects

---

### 1.5 Views / Beelden (User-side of IKO)
**Module:** `@valtimo/iko`
**Menu location:** Sidebar under "Beelden" (Views)

**Description:**
Views (Beelden) is the user-facing side of IKO (Integraal Klant- en Objectbeeld). It allows users to search and view integrated customer and object information.

**Routes:**
- `/iko/:key` - IKO search
- `/iko/:key/:searchKey` - IKO results
- `/iko/:key/:searchKey/details/:id` - IKO details

**Functionality:**
- [ ] Search IKO objects
- [ ] View search results
- [ ] View IKO object details

---

## 2. Admin Features (ROLE_ADMIN)

### 2.1 Case Management
**Module:** `@valtimo/case-management`
**Routes:**
- `/case-management` - Case definition list
- `/case-management/case/:caseDefinitionKey/version/:caseDefinitionVersionTag` - Case configuration

**Tabs within case configuration:**
| Tab | Description |
|-----|-------------|
| General | Link upload process, Case handler settings, External start form |
| Processes | Linked processes overview, Create/edit processes via BPMN modeler |
| Decision tables | Linked decision tables |
| Document | Document definition configuration |
| Forms | Form management |
| Form Flows | Form flow configuration |
| Tasks | Task configuration |
| Case list | Case list view configuration |
| Case details | Case detail tabs/widgets configuration |
| ZGW | Zaakgericht Werken configuration (Dutch municipal standard) - see detailed section below |

**General tab features:**
- [ ] Link upload process to case (dropdown)
- [ ] Case handler toggle (Yes/No)
- [ ] Auto-assign user tasks to case handler toggle
- [ ] External start form toggle
- [ ] External start form URL input
- [ ] External start form description

**Processes tab features:**
- [ ] View linked processes table (Name, Key, Read-only, Starts case, Startable by user)
- [ ] Create new process button
- [ ] Open process in BPMN modeler
- [ ] BPMN modeler with drag-drop elements
- [ ] Process properties: Starts case toggle, Startable by user toggle
- [ ] Save process

**Process Link configuration (wizard):**
When clicking on a process step (User Task), a "Create process link" button appears. This opens a wizard:

| Step | Description |
|------|-------------|
| 1. Choose link type | Options: Form, FormFlow, Plugin, UI Component* |
| 2. Select configuration | Depends on link type chosen |
| 3. Choose action | For Plugin: select available actions |
| 4. Configure action | Configure the selected action |

*UI Component is only available when a custom Process Link component has been created and registered in the Angular application. Not available in the standard Docker image.

**Link type: Form**
- [ ] Select form dropdown
- [ ] Select form display type (Modal / Panel)
- [ ] Select modal size (Extra small / Small / Medium / Large)
- [ ] Add subtitles

**Link type: FormFlow**
- [ ] Select FormFlow dropdown
- [ ] Select form display type (Modal / Panel)
- [ ] Select modal size
- [ ] Add subtitles

**Link type: Plugin**
- [ ] Select plugin configuration (shows available plugins with logo, name, description)
- [ ] Choose action (e.g., "Create portal task" for Portaaltaak)
- [ ] Configure action fields (varies per plugin)

**Plugin action example - Portaaltaak "Create portal task":**
- [ ] Form type dropdown (Form definition)
- [ ] Form ID input
- [ ] Task data for recipient (Add row button)
- [ ] Information entered by recipient (Add row button)
- [ ] Receiver dropdown (e.g., Case initiator)
- [ ] Number of days for task to expire

**Version management:**
- [ ] Version dropdown showing current version (e.g., "DRAFT: 1.0.0")
- [ ] "Globally active" badge
- [ ] "See all versions" link
- [ ] Version management button

**Note:** BPMN properties panel (Asynchronous continuations, Execution listeners, Extension properties, etc.) is out of scope.

**Decision tables tab (Beslistabellen):**
- [ ] View linked decision tables (Key, Name, Version columns)
- [ ] Upload decision table button
- [ ] Upload DMN file modal (only .dmn files allowed)
- [ ] Click to open decision table in DMN editor

**DMN Editor:**
- [ ] View DRD (Decision Requirements Diagram) button
- [ ] Decision table name
- [ ] Hit policy dropdown (First, Unique, Any, etc.)
- [ ] Input columns (When/And) with data type
- [ ] Output columns (Then) with data type
- [ ] Annotations column
- [ ] Add/edit/delete rules (rows)
- [ ] Add/remove columns
- [ ] Save decision table

**Document tab:**
- [ ] View JSON Schema definition (read-only mode)
- [ ] Download JSON Schema button
- [ ] Edit (Aanpassen) button to enter edit mode
- [ ] JSON Schema editor with line numbers
- [ ] Cancel (Annuleren) and Save (Opslaan) buttons in edit mode
- [ ] Schema follows JSON Schema draft-07 format

**Forms tab (Formulieren):**
- [ ] View forms list (Form name, Read-only columns)
- [ ] Search forms
- [ ] Filter forms
- [ ] Create form button (Formulier creëren)
- [ ] Add form modal with Name input
- [ ] Pagination (Items per page, page navigation)
- [ ] Row actions menu (three-dot)

**Form Editor (Form.io based):**
Three tabs available:
1. **Formulier-bewerker (Form Builder):**
   - [ ] Drag-drop form components from left panel to canvas
   - [ ] Search field(s) filter
   - [ ] Component categories:
     - Basic: Text Field, Document picker, Text Area, Number, Password, Checkbox, Select Boxes, Select, Radio, Button, Valtimo File Upload
     - Advanced
     - Layout
     - Data
     - Premium
     - Existing
   - [ ] Form preview on canvas
   - [ ] Click component to configure

2. **JSON-bewerker (JSON Editor):**
   - [ ] Raw JSON editor with syntax highlighting
   - [ ] View/edit form.io JSON definition directly

3. **Resultaat (Result/Preview):**
   - [ ] Live form preview with input fields
   - [ ] JSON output panel showing form data
   - [ ] Test form submission

**Form Component Configuration Modal:**
- [ ] Tabs: Display, Data, Validation, API, Conditional, Logic, Layout
- [ ] Display tab fields: Label, Label Position, Placeholder, Description, Tooltip, Prefix, Suffix, Widget, Input Mask, Display Mask, Apply Mask On
- [ ] Preview panel
- [ ] Save, Cancel, Remove buttons

**Form Flows tab:**
- [ ] View form flows list (Key, Version, Read-only columns)
- [ ] Add new form flow button (Nieuwe form flow toevoegen)
- [ ] Add form flow modal with Key input
- [ ] Click to open form flow in JSON editor

**Form Flow Editor:**
- [ ] JSON editor with line numbers and syntax highlighting
- [ ] Form flow structure:
  - key: unique identifier
  - startStep: initial step key
  - steps: array of step definitions
    - key: step identifier
    - title: display title
    - nextSteps: array of next step references
    - type: { name: "form", properties: { definition: "form-definition-name" } }
- [ ] Back (Terug) button
- [ ] Save (Opslaan) button

**Tasks tab (Taken):**
Configuration for the task list view. Has two subtabs: Kolommen (Columns) and Zoekvelden (Search fields).

*Kolommen (Columns) subtab:*
- [ ] View columns table (empty state with illustration when no columns)
- [ ] Table columns: Titel, Key, Pad, Weergavetype, Parameters, Sorteerbaar, Standaardsortering
- [ ] Drag handles to reorder columns
- [ ] Add column button (Kolom toevoegen)
- [ ] Row actions menu
- [ ] Toggle between table view and JSON view (</> button)
- [ ] Download configuration button

**Add column modal:**
- [ ] Titel (optioneel) input
- [ ] Key input
- [ ] Pad (path) input
- [ ] Weergavetype (display type) dropdown
- [ ] Sorteerbaar (sortable) checkbox
- [ ] Standaardsortering (default sorting) dropdown (optional)
- [ ] Close (Sluiten) and Save (Kolom opslaan) buttons

*Zoekvelden (Search fields) subtab:*
- [ ] View search fields table (Titel, Key, Pad, Datatype, Veldtype)
- [ ] Drag handles to reorder
- [ ] Add search field button (Zoekveld toevoegen)
- [ ] Toggle between table view and JSON view

**Add search field modal:**
- [ ] Titel input
- [ ] Key input
- [ ] Pad (path) with dropdown toggle and path selector
- [ ] Datatype dropdown
- [ ] Veldtype (field type) dropdown
- [ ] Cancel (Annuleren) and Save (Opslaan) buttons

**Case list tab (Dossierlijst):**
Configuration for the case list view. Same structure as Tasks tab with Kolommen and Zoekvelden subtabs.

*Warning banner:* "Niet gekoppeld aan een versie van het dossiertype" - Changes apply to all versions of this case type, not just the selected version.

*Kolommen (Columns) subtab:*
- [ ] View columns table (Titel, Key, Pad, Weergavetype, Parameters, Sorteerbaar, Standaardsortering, Exporteerbaar)
- [ ] Drag handles to reorder columns
- [ ] Add column button (Kolom toevoegen)
- [ ] Row actions menu
- [ ] Toggle between table view and JSON view (</> button)
- [ ] Download configuration button
- [ ] Edit button (Aanpassen)

**Column JSON structure:**
```json
{
  "title": "Column Title",
  "key": "columnKey",
  "path": "doc:path.to.field",
  "displayType": {
    "type": "text",
    "displayTypeParameters": {}
  },
  "sortable": true,
  "order": 0,
  "exportable": false
}
```

*Zoekvelden (Search fields) subtab:*
- [ ] View search fields table (Titel, Key, Pad, Datatype, Veldtype)
- [ ] Drag handles to reorder
- [ ] Add search field button (Zoekveld toevoegen)
- [ ] Toggle between table view and JSON view

**Search field JSON structure:**
```json
{
  "key": "fieldKey",
  "path": "doc:path.to.field",
  "dataType": "text",
  "fieldType": "single",
  "matchType": "like",
  "dropdownDataProvider": null,
  "title": "Field Title"
}
```

**Case details tab (Dossierdetails):**
Configuration for the case detail view. Has four subtabs: Tabbladen (Tabs), Statussen (Statuses), Tags, and Header.

*Warning banner:* "Niet gekoppeld aan een versie van het dossiertype" - Changes apply to all versions of this case type.

*Tabbladen (Tabs) subtab:*
- [ ] View tabs table (Tab naam, Tab-key, Type, Inhoud, Takenlijst zichtbaar)
- [ ] Drag handles to reorder tabs
- [ ] Add tab button (Tabblad toevoegen)
- [ ] Row actions menu

**Tab types (Inhoud):**
- Voortgang (Progress)
- Log
- Documenten (Documents)
- Notities (Notes)
- widgets (custom widgets)

**Add tab modal:**
- [ ] Select tab type:
  - Standaardtabblad (Standard tab)
  - FormIO component
  - Maatwerkcomponent (Custom component) - only available with custom implementations
  - Widgets component
- [ ] Cancel (Annuleren) link

*Statussen (Statuses) subtab:*
- [ ] View statuses table (Statusnaam, Status-key, Standaard zichtbaar, Kleur)
- [ ] Drag handles to reorder statuses
- [ ] Color badges displayed (Blauw, Paars, Rood, Blauwgroen, Magenta, Groen, etc.)
- [ ] Add status button (Status toevoegen)
- [ ] Row actions menu

**Add status modal:**
- [ ] Statusnaam input
- [ ] Status-key (auto-generated, with edit button)
- [ ] Kleur (color) dropdown
- [ ] Standaardzichtbaarheid in dossierlijst toggle (Zichtbaar/default visibility in case list)
- [ ] Cancel (Annuleren) and Add (Toevoegen) buttons

*Tags subtab:*
- [ ] View tags table
- [ ] Add tag button (Tag toevoegen)

**Add tag modal:**
- [ ] Naam input
- [ ] Key (auto-generated, with edit button)
- [ ] Kleur (color) dropdown
- [ ] Cancel (Annuleren) and Add (Toevoegen) buttons

*Header subtab:*
- [ ] View header widgets table (Titel, Type, Hoog contrast)
- [ ] Widget types shown as badges (e.g., "Velden")
- [ ] Add widget button (Widget toevoegen)

**Widget Configuration:**

Widgets are configured through a visual editor or JSON editor. The widget tab detail page shows both options with a toggle (</> button).

*Widget creation wizard (6 steps):*

**Step 1: Kies widget-type (Choose widget type)**
Available widget types:
| Type | Description (NL) | Description (EN) |
|------|------------------|------------------|
| Velden | Tekstgegevens met inhoud en een label | Text data with content and a label |
| Eigen component | Voor complexe inhoud | For complex content (requires custom implementation) |
| Form.io | Ingevuld Form.io-formulier | Filled Form.io form |
| Tabel | Maak een tabel aan | Create a table |
| Collectie | Maak een collectie aan | Create a collection |
| Kaart | Maak een kaart widget aan | Create a map widget |
| Scheidingslijn | Widget divider/separator | Divider between widgets |

**Step 2: Kies widget-breedte (Choose widget width)**
| Width | Columns | Description |
|-------|---------|-------------|
| Klein | 1 col | Small width |
| Medium | 2 col | Medium width |
| Groot | 3 col | Large width |
| Xtra Groot | 4 col | Extra large width |

**Step 3: Kies widgetdichtheid (Choose widget density)**
- Standaard (Standard)
- Compact

**Step 4: Kies widget-stijl (Choose widget style)**
- Standaard (Standard)
- Hoog contrast (High contrast)

**Step 5: Kies widget-inhoud (Choose widget content)**
- [ ] Widget titel (title) input
- [ ] Icoon (icon) selection
- [ ] Type actieknop (action button type) dropdown
- [ ] Kolommen (columns) with + button to add
- [ ] Per column: Add fields with configuration

**Field configuration within columns:**
- [ ] Titel (title) input
- [ ] Weergavetype (display type) dropdown
- [ ] Waarde (value) with Dropdown toggle for path selection
- [ ] Verbergen indien leeg (hide if empty) toggle

**Path dropdown options (case:* paths):**
- case:assigneeFullName
- case:assigneeId
- case:caseTags
- case:createdBy
- case:createdOn
- case:externalId
- case:internalStatus
- case:lastModifiedBy
- case:lastModifiedOn
- case:sequence
- doc:* (document paths from JSON Schema)

**Weergavetype (display type) options:**
| Type | Description |
|------|-------------|
| Tekst | Plain text |
| Ja/Nee | Boolean (Yes/No) |
| Valuta | Currency |
| Datum | Date |
| Datum en tijd | Date and time |
| Opsomming | Enumeration/list |
| (and more...) | |

**Step 6: Weergavecondities instellen (Set display conditions)**
- [ ] Add display conditions for when widget should be shown
- [ ] Condition builder with field path, operator, and value

**Widget editors:**
- [ ] Visual editor (default) - form-based configuration
- [ ] JSON editor - raw JSON configuration

**Widget tab overview page:**
- [ ] View widgets table (Titel, Type, Key, Breedte, Dichtheid, Hoog contrast)
- [ ] Drag handles to reorder widgets
- [ ] Type badges (Velden, Scheidingslijn, etc.)
- [ ] Three-dot row actions menu
- [ ] "Scheiding toevoegen" button (Add divider)
- [ ] "Widget toevoegen" button (Add widget)
- [ ] Toggle between Visual editor and JSON editor tabs
- [ ] Bewerk (Edit) button

**Add widget divider modal (Nieuwe widget-scheiding toevoegen):**
- [ ] Scheider-titel (optioneel) input - Divider title
- [ ] Scheider-sleutel (automatisch gegenereerd) - Auto-generated key with edit button
- [ ] Sluiten / Aanmaken buttons

**Widget type-specific configurations:**

*Tabel widget (Table):*
- [ ] Widget titel input
- [ ] Icoon selection dropdown
- [ ] Rijen per pagina (Rows per page) - default 5
- [ ] Pad naar tabeldata (Path to table data) with Dropdown toggle
- [ ] Type actieknop dropdown (e.g., Process)
- [ ] Nieuwe procesknop (Optioneel) - Select process dropdown
- [ ] Nieuwe procesknoptekst (Optioneel) - Button text input
- [ ] Kolommen (Columns) section:
  - Expandable column configuration
  - Titel input
  - Weergavetype dropdown
  - Waarde with Dropdown toggle for path selection
  - "Kolom toevoegen" button to add columns
- [ ] Opties section:
  - "Eerste kolom is de titel van de rij" toggle (First column is row title)

*Collectie widget (Collection):*
- [ ] Widget titel input
- [ ] Icoon selection dropdown
- [ ] Kaarten per pagina (Cards per page) - default 5
- [ ] Pad naar collectiedata (Path to collection data) with Dropdown toggle
- [ ] Type actieknop dropdown (e.g., Process)
- [ ] Nieuwe procesknop (Optioneel) - Select process dropdown
- [ ] Nieuwe procesknoptekst (Optioneel) - Button text input
- [ ] Kaarttitel (Card title) section:
  - Waarde with Dropdown toggle for path selection
  - Weergavetype dropdown
- [ ] Kaart-velden (Card fields) section:
  - Expandable field configuration
  - Titel input
  - Weergavetype dropdown
  - Veldbreedte (Field width) dropdown - e.g., Volle-breedte (Full width)
  - Waarde with Dropdown toggle for path selection
  - Verbergen indien leeg checkbox (Hide if empty)
  - "Veld toevoegen" button to add fields

*Kaart widget (Map):*
- [ ] Widget titel input
- [ ] Type actieknop dropdown (e.g., Process)
- [ ] Nieuwe procesknop (Optioneel) - Select process dropdown
- [ ] Nieuwe procesknoptekst (Optioneel) - Button text input
- [ ] Kaart laag (Map layer) sections:
  - Expandable layer configuration
  - Pad naar GeoJSON data (Path to GeoJSON data) input
  - Delete layer button
  - "Veld toevoegen" button to add layers

**Widget JSON structure example:**
```json
{
  "key": "widget-key",
  "title": "Widget Title",
  "width": 2,
  "highContrast": false,
  "type": "fields",
  "properties": {
    "columns": [
      {
        "fields": [
          {
            "title": "Field Title",
            "key": "fieldKey",
            "path": "doc:path.to.field",
            "displayType": "text",
            "hideIfEmpty": false
          }
        ]
      }
    ]
  },
  "displayConditions": []
}
```

**ZGW tab (Zaakgericht Werken):**
Configuration for Dutch municipal ZGW standard integration. Has four subtabs: Algemeen, Document kolommen, Document upload-velden, Document trefwoorden.

*Warning banner:* "Niet gekoppeld aan een versie van het dossiertype" - Changes apply to all versions of this case type.

*Algemeen (General) subtab:*
Three sections displayed side by side:

**Zaakdetails-synchronisatie (Case details synchronization):**
- [ ] "Configureer zaakdetails-synchronisatie" button (+)
- [ ] Add synchronization modal:
  - Object management-configuratie (vereist) dropdown
  - Ingeschakeld checkbox (Enabled)
  - Annuleren / Indienen buttons

**Documenten API:**
- [ ] Shows Documenten API plugin version info (e.g., "1.4.2-maykin-1.13.0")

**Gekoppeld zaak type (Connected zaak type):**
- [ ] Displays linked zaaktype name (e.g., "Aanvraag evenementenvergunning")
- [ ] Shows configuration details:
  - Automatisch aanmaken voor elk dossier (Ja/Nee)
  - Zaken Api plugin name
  - RSIN gebruikt bij aanmaken zaak
- [ ] Aanpassen (Edit) button
- [ ] Verwijderen (Delete) button

**Zaak types modal ("Connect Zaak type to Dossier"):**
- [ ] Kies zaaktype voor dossier dropdown
- [ ] Kies Zaken Api plugin voor aanmaken zaak dropdown
- [ ] RSIN gebruikt bij aanmaken zaak input
- [ ] Automatisch aanmaken voor elk dossier toggle (On/Off)
- [ ] Annuleren / Opslaan buttons

*Document kolommen (Document columns) subtab:*
Configure columns displayed in document list view.
- [ ] View columns table (Kolom, Standaardsortering)
- [ ] Drag handles to reorder columns
- [ ] Available columns: Titel, Aanmaakdatum, Auteur, Bestandsomvang, Informatieobjecttype
- [ ] "Kolom toevoegen" button
- [ ] Three-dot row actions menu

**Kolom toevoegen modal:**
- [ ] Kolom dropdown
- [ ] Default sort radio buttons:
  - Geen standaardsortering (No default sorting)
  - Aflopend (Descending)
  - Oplopend (Ascending)
- [ ] Warning: "Als je een standaardsortering selecteert, wordt de bestaande standaardsortering overschreven"
- [ ] Annuleren / Toevoegen buttons

*Document upload-velden (Document upload fields) subtab:*
Configure fields shown during document upload.
- [ ] View fields table (Veld, Standaardwaarde, Zichtbaar, Alleen lezen)
- [ ] Available fields:
  - AanvullendeDatum (Additional date)
  - Beschrijving (Description)
  - Bestandsnaam (Filename)
  - Creatiedatum (Creation date)
  - Status (e.g., "definitief")
  - Taal (Language, e.g., "nld")
  - Trefwoorden (Keywords)
  - Vertrouwelijkheidsaanduiding (Confidentiality level, e.g., "intern")
  - Titel (Title)
  - Auteur (Author)
  - Informatieobjecttype (Information object type)
- [ ] Three-dot row actions menu
- [ ] Zichtbaar column shows Ja/Nee or "Veld" badge
- [ ] Alleen lezen column shows Ja/Nee

*Document trefwoorden (Document keywords) subtab:*
Manage predefined keywords for document tagging.
- [ ] View keywords table (Trefwoord column)
- [ ] Checkbox selection for bulk actions
- [ ] Search functionality
- [ ] "Trefwoord toevoegen" button
- [ ] Pagination (Items per page, page navigation)
- [ ] Three-dot row actions menu

**Trefwoord toevoegen modal:**
- [ ] Trefwoord input
- [ ] Annuleren / Toevoegen buttons

---

### 2.2 Process Management
**Module:** `@valtimo/process-management`
**Routes:**
- `/processes` - Process list
- `/processes/create` - Create new process
- `/processes/:processDefinitionKey` - Edit process (BPMN modeler)

**Functionality:**
- [ ] View processes overview
- [ ] Create new process
- [ ] Edit BPMN process
- [ ] Deploy process
- [ ] Manage process versions

---

### 2.3 Decision Tables
**Module:** `@valtimo/decision`
**Routes:**
- `/decision-tables` - Decision table list
- `/decision-tables/:id` - View decision table
- `/decision-tables/edit/:id` - Edit decision table
- `/decision-tables/edit/create` - New decision table

**Functionality:**
- [ ] View decision tables overview
- [ ] Create decision table
- [ ] Edit decision table (DMN modeler)
- [ ] Test decision table

---

### 2.4 Plugin Management
**Module:** `@valtimo/plugin-management`
**Route:** `/plugins`

**Functionality:**
- [ ] Manage plugin configurations
- [ ] Add new plugin configuration
- [ ] Edit plugin configuration
- [ ] Delete plugin configuration

**Available plugins (frontend configuration):**
- Catalogi API
- Documenten API
- Notificaties API
- Object Token Authentication
- Objecten API
- Objecttypen API
- Open Zaak
- Portaaltaak
- Smart Documents
- Verzoek
- Zaken API
- Exact

---

### 2.5 Dashboard Management
**Module:** `@valtimo/dashboard-management`
**Routes:**
- `/dashboard-management` - Dashboard configuration list
- `/dashboard-management/:id` - Configure dashboard details

**Functionality:**
- [ ] Manage dashboards
- [ ] Configure dashboard widgets
- [ ] Assign dashboard to roles

---

### 2.6 Access Control Management
**Module:** `@valtimo/access-control-management`
**Routes:**
- `/access-control` - Roles overview
- `/access-control/:id` - Role details/permissions

**Functionality:**
- [ ] View roles
- [ ] Configure role permissions
- [ ] Set permissions per resource type

---

### 2.7 Object Management
**Module:** `@valtimo/object-management`
**Routes:**
- `/object-management` - Object types list
- `/object-management/object/:id` - Object type configuration

**Functionality:**
- [ ] Manage object types
- [ ] Edit object type configuration

---

### 2.8 Building Block Management
**Module:** `@valtimo/building-block-management`
**Routes:**
- `/building-block-management` - Building blocks list
- `/building-block-management/building-block/:key/version/:versionTag/:tabKey` - Building block details

**Description:**
Building blocks let you package a reusable subprocess with its own data model and version it separately from cases. This allows them to use their own data and configuration. You can use the same building block in multiple case definitions and across environments, while keeping a clear input and output contract.

**Functionality:**
- [ ] Manage building blocks
- [ ] Configure building block processes
- [ ] Manage building block versions

---

### 2.9 Translation Management
**Module:** `@valtimo/layout`
**Route:** `/translation-management`

**Functionality:**
- [ ] Manage translations
- [ ] Add new translations
- [ ] Edit existing translations

---

### 2.10 IKO Management
**Module:** `@valtimo/iko`
**Routes:**
- `/iko-management` - IKO API overview
- `/iko-management/:apiKey` - IKO configuration per API
- `/iko-management/:apiKey/:key/:tabKey` - IKO details configuration

**Functionality:**
- [ ] Configure IKO APIs
- [ ] Configure search actions
- [ ] Configure IKO widgets

---

### 2.11 Choice Fields
**Module:** `@valtimo/choice-field`
**Route:** `/choice-fields` _(to be confirmed)_

**Functionality:**
- [ ] Manage choice field definitions
- [ ] Add/edit/delete choice field options

---

### 2.12 Failed Notifications
**Route:** Under Object Management section

**Functionality:**
- [ ] View failed notifications
- [ ] Retry failed notifications
- [ ] Delete failed notifications

---

### 2.13 Logs
**Route:** Under Other section

**Functionality:**
- [ ] View application logs
- [ ] Filter/search logs

---

### 2.14 Case Migration (Beta)
**Route:** Under Other section

**Functionality:**
- [ ] Migrate cases between versions
- [ ] View migration status

---

### 2.15 Process Migration
**Route:** Under Other section

**Functionality:**
- [ ] Migrate process instances
- [ ] View migration status

---

## 3. Shared Components

### 3.1 Layout
**Module:** `@valtimo/layout`

**Components:**
- Navigation menu (sidebar) with collapsible sections
- Header/topbar with user info
- Breadcrumbs
- Page title
- Version/status badges (e.g., "DRAFT: 1.0.0", "Globally active")

---

### 3.2 Forms
**Module:** `@valtimo/form`, `@valtimo/form-view-model`

**Components:**
- Form.io integration
- Form view model rendering
- Form validation
- Form display types: Modal, Panel
- Modal sizes: Extra small, Small, Medium, Large

---

### 3.3 Modals and Dialogs
**Module:** `@valtimo/components`

**Types:**
- Confirmation modals
- Form modals
- Wizard modals (multi-step)
- Error message modals

---

### 3.4 Tables
**Module:** `@valtimo/components`

**Functionality:**
- Pagination
- Sorting
- Filtering
- Column configuration
- Row actions (three-dot menu)

---

## 4. E2E Test Scenarios

_This section will be expanded after completing the feature overview._

### Template for test scenarios:

```
### [Feature Name] - [Scenario Name]

**Preconditions:**
- ...

**Steps:**
1. ...
2. ...
3. ...

**Expected result:**
- ...

**Related features:**
- ...
```

---

## Notes

- This document is a living document and will be updated based on screenshots and feedback
- BPMN properties panel is out of scope
- UI Component link type is only available with custom implementations
- ZGW = Zaakgericht Werken (Dutch municipal standard for case management)
