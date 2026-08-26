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
| Dashboard | Donut charts with many categories display the circle correctly |
| Document schemas | Recursive schema references no longer crash the server |
| Draft environments | Default Spring profiles now correctly enable draft mode |
| Notificaties API | Subscription registration no longer causes a restart loop on startup |
| Process editor | Exported process definition now named after the process instead of `diagram.bpmn` |
| Process links | Links no longer leak into another case definition or building block |
| Process upload | File dialog filters on supported types again; drag-and-drop works for BPMN files and packages |
| Search fields | Date searches return results with correct date format |
| Tasks | Tasks of cases that were already running before the upgrade to 13 can be opened again |
| Widgets | Image widget no longer offers `task:` fields it cannot show |
| Cases | The progress tab shows the name of every process, instead of leaving some blank |
