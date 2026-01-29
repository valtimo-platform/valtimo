# IKO Client - Required Screenshots

This document lists the screenshots that should be added to the IKO Client documentation. Screenshots help functional administrators understand the UI configuration options.

---

## README.md

| Screenshot | Description | Placement |
|------------|-------------|-----------|
| `iko-overview.png` | IKO detail screen showing a customer view with tabs and widgets populated with data | After "What is IKO?" section, to give users an immediate visual understanding of what IKO looks like |

---

## views.md

| Screenshot | Description | Placement |
|------------|-------------|-----------|
| `admin-iko-menu.png` | Admin menu showing the "IKO" option | After step 1 "Navigate to Admin → IKO" |
| `add-iko-server.png` | Dialog/form for adding a new IKO Server with the fields Title, Key, and IKO Server URL | After "Adding an IKO Server" section |
| `iko-server-list.png` | List of configured IKO Servers | After adding server, showing the result |
| `add-view-form.png` | Form for creating a new View with all configuration fields visible | After "Creating a View" section |

---

## search-actions.md

| Screenshot | Description | Placement |
|------------|-------------|-----------|
| `search-actions-list.png` | List of search actions for a view (e.g., "Search by BSN", "Search by name") | After "Overview" section |
| `add-search-action.png` | Form/dialog for adding a new search action | After "Adding a search action" |
| `search-field-config.png` | Configuration of search fields for a search action, showing Key, Title, Path, Data type, Field type fields | After "Configuring search fields" |
| `search-field-drag-drop.png` | Search fields with drag handles visible, showing reordering capability | Near the hint about drag & drop |
| `search-screen-user.png` | The search screen as seen by end users, showing the search form with fields | At the end, to show the result of the configuration |

---

## list.md

| Screenshot | Description | Placement |
|------------|-------------|-----------|
| `list-columns-config.png` | Configuration screen for list columns showing Title, Key, Path, Display Type, Sortable options | After "Configuring list columns" |
| `search-results-table.png` | Search results table as seen by end users, with multiple columns of data | At the end, to show the result of the configuration |

---

## tabs.md

| Screenshot | Description | Placement |
|------------|-------------|-----------|
| `tabs-config-list.png` | List of configured tabs for a view (e.g., General, Cases, Documents) | After "Overview" section |
| `add-tab-form.png` | Form for adding a new tab | After "Creating a tab" |
| `tabs-user-view.png` | Detail screen as seen by end users, showing the tab navigation | At the end, to show the result |

---

## widgets.md

| Screenshot | Description | Placement |
|------------|-------------|-----------|
| `widget-wizard-step1.png` | Widget wizard step 1: Choose widget type (Fields, Collection, Interactive table options visible) | After "Step 1: Choose widget type" |
| `widget-wizard-step2.png` | Widget wizard step 2: Choose widget width (Small, Medium, Large, Extra large options) | After "Step 2: Choose widget width" |
| `widget-wizard-step3.png` | Widget wizard step 3: Choose widget density (Default, Compact options) | After "Step 3: Choose widget density" |
| `widget-wizard-step4.png` | Widget wizard step 4: Choose widget style (Default, High contrast options) | After "Step 4: Choose widget style" |
| `widget-wizard-step5.png` | Widget wizard step 5: Configure content with title, icon, columns, and fields | After "Step 5: Choose widget content" |
| `widget-wizard-step6.png` | Widget wizard step 6: Display conditions configuration | After "Step 6: Set display conditions" |
| `widget-fields-example.png` | A Fields widget as displayed to end users, showing key-value pairs | After widget types table, as example |
| `widget-collection-example.png` | A Collection widget as displayed to end users, showing a list of items | After widget types table, as example |
| `widget-interactive-table-example.png` | An Interactive table widget as displayed to end users, with sorting/filtering | After widget types table, as example |
| `widget-high-contrast.png` | Comparison of Default vs High contrast widget style | After "Step 4: Choose widget style" |
| `widgets-drag-drop.png` | Widget list with drag handles visible, showing reordering capability | After "Widget order and dividers" |
| `widget-divider-example.png` | Widgets separated by a divider | After "Widget order and dividers" |
| `visual-vs-json-editor.png` | Toggle or tabs showing Visual editor and JSON editor options | After "Visual Editor vs JSON Editor" |

---

## Screenshot specifications

### Technical requirements

- **Format**: PNG
- **Width**: 800-1200px (will be scaled by GitBook)
- **Quality**: High resolution, clear text
- **Browser**: Chrome (for consistency)
- **Theme**: Use default Valtimo theme

### Content guidelines

- Remove or blur any sensitive data (real BSN numbers, names, etc.)
- Use realistic but fictional test data
- Ensure UI elements are fully visible (no cut-off buttons or text)
- Capture the relevant area only, not the entire browser window
- Include relevant context (e.g., breadcrumbs, page title) where helpful

### File location

Place screenshots in:
```
.gitbook/assets/iko/
├── iko-overview.png
├── admin-iko-menu.png
├── add-iko-server.png
└── ...
```

### Adding screenshots to documentation

Use the GitBook figure syntax:

```markdown
<figure><img src="../../.gitbook/assets/iko/screenshot-name.png" alt="Description"><figcaption><p>Caption text</p></figcaption></figure>
```

---

## Priority

Screenshots are prioritized as follows:

### High priority (essential for understanding)
1. `iko-overview.png` - First impression of IKO
2. `widget-wizard-step5.png` - Most complex configuration step
3. `search-screen-user.png` - Shows end result
4. `tabs-user-view.png` - Shows end result

### Medium priority (helpful for configuration)
5. `add-iko-server.png`
6. `add-view-form.png`
7. `search-field-config.png`
8. `list-columns-config.png`
9. `widget-fields-example.png`
10. `widget-interactive-table-example.png`

### Lower priority (nice to have)
11. All other wizard steps
12. Drag & drop screenshots
13. Visual vs JSON editor
