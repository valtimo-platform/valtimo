# 13.43.0

Release date: 26-08-2026

---

## New Features

### Complete process export

Export a process together with everything it needs: process links, called sub-processes, decision tables, and forms. Import the package on another environment and it works without recreating those elements by hand.

Use **Export** in the process menu to download a package, then upload it on the target environment. The package contains a manifest naming the process, its version, and the plugins its links need. During import:

- The preview lists which existing processes, decision tables, and forms will be replaced
- Plugin links can be mapped to the plugin configurations available

### Process bean selection

Configure expressions without knowing bean names or method signatures. Expression fields in the BPMN modeler now offer a dropdown mode: select a service, pick a method, fill in the parameters. Descriptions explain what each method does.

### Activity markers

Small badges on BPMN elements show configuration at a glance: **P** for process link, **E** for execution listener, **T** for task listener. A toggle in the bottom-right corner of the canvas shows or hides the markers.

### Autofill tracking

Elements with values auto-filled by Valtimo show a blue indicator on the canvas and a notification in the properties panel. Dismiss the notification after reviewing to acknowledge the auto-fill.

---

## Enhancements

### Smarter start event validation

Start events without forms no longer trigger warnings when the process is not user-startable.

### Standardized validation error codes

Validation messages use a consistent error code format for easier troubleshooting.

### Case definition key and version in case inspection

The metadata tab of the case inspection page now displays the case definition key and version.

### Building block call activities are now validated

The configuration of a building block call activity is checked when the process is saved and when the call activity starts. Mistakes that previously made a building block silently work on the wrong case data — such as a missing or wrong business key mapping — now block the save, and the process editor highlights the call activity with a message that explains how to fix it. See the [building block documentation](../../../configuration-guides/building-blocks/processes.md) for the call activity requirements.

### Clearer rules for building block input and output mappings

Values passed to a building block are stored in its document, and results are read back from it. Mappings that do not follow this are now rejected when the process is saved, with the offending activity highlighted in the process editor, instead of being silently ignored at runtime. How data flows in and out of a building block is described in the [building block documentation](../../../configuration-guides/building-blocks/processes.md).

### Better diagnostics for plugin actions

When a plugin action property resolves to no value, a debug log entry now names the property, the activity and the process definition, making it easier to trace why an action behaves as if a value was never provided.

---

## Bugfixes

| Area | Fix |
|------|-----|
| BPMN modeler | Orphaned invisible elements cleaned up on save |
| Case export | Forms shown in a widget are included in the case export |
| Case definitions | Configuration warnings disappear when the offending process links or process are removed |
| Case notes | The options menu of a note is now correctly translated |
| Case widgets | Long texts wrap correctly without overlapping other content |
| Cases | A case that cannot be found no longer stops a process, an assignment, or a note |
| Cases | A case with building blocks can be deleted again |
| Cases | The case list title and breadcrumb show the name of the active case version, matching the menu |
| Cases | The process selector on the Progress tab shows long process names in full instead of cutting them off |
| Choice fields | Deprecated choice field values no longer appear in form dropdowns |
| Dashboard | Donut charts with many categories display the circle correctly |
| Document schemas | Recursive schema references no longer crash the server |
| Draft environments | Default Spring profiles now correctly enable draft mode |
| Forms | The IBAN component keeps the entered value when the IBAN is invalid |
| Notificaties API | Subscription registration no longer causes a restart loop on startup |
| Process editor | Exported process definition now named after the process instead of `diagram.bpmn` |
| Process links | Links no longer leak into another case definition or building block |
| Process upload | File dialog filters on supported types again; drag-and-drop works for BPMN files and packages |
| Search fields | Date searches return results with correct date format |
| Tasks | Tasks of cases that were already running before the upgrade to 13 can be opened again |
| Widgets | Image widget no longer offers `task:` fields it cannot show |
