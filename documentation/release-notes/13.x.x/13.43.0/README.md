# 13.43.0

Release date: 26-08-2026

---

## New Features

### Process bean selection

Expression fields in the BPMN modeler now offer a dropdown mode for selecting process beans and their methods. Pick from available services and methods instead of typing expressions manually.

### Activity markers

Visual indicators on BPMN elements show configuration at a glance: **P** for process link, **E** for execution listener, **T** for task listener. Spot configured activities instantly without opening the properties panel.

### Autofill tracking

Properties auto-filled by Valtimo are now marked in the properties panel. Dismiss the indicator after reviewing to keep your panel clean.

---

## Enhancements

### Smarter start event validation

Start events without forms no longer trigger warnings when the process isn't user-startable. Fewer false positives during process validation.

### Standardized validation error codes

Validation messages now use a consistent error code format, making it easier to identify and troubleshoot issues.

### Case definition key and version in case inspection

The metadata tab of the case inspection page now displays the case definition key and version. This makes it clear which version of a case definition a case belongs to.

### Faster first page load

The JavaScript that a browser has to download before the application starts has been reduced by roughly a third. The Swagger viewer, the DMN editor, the JSON schema editor and the map widget are now fetched only when the screen that uses them is opened, and two large scripts that were loaded on every page but never used have been removed. The deployed image is also considerably smaller, because only the part of the code editor that is actually used is shipped.

---

## Bugfixes

| Area | Fix |
|------|-----|
| BPMN modeler | Orphaned invisible elements cleaned up on save |
| Draft environments | Default Spring profiles now correctly enable draft mode |
| Search fields | Date searches return results with correct date format |
| Cases | A case with building blocks can be deleted again |
| Document schemas | Recursive schema references no longer crash the server |
| Cases | A case that cannot be found no longer stops a process, an assignment or a note |
| Dashboard | Donut charts with many categories display the circle correctly |
| Process links | Links no longer leak into another case definition or building block |
| Notificaties API | Subscription registration no longer causes a restart loop on startup |
| Case export | Forms shown in a widget are included in the case export |
| Tasks | Tasks of cases that were already running before the upgrade to 13 can be opened again |
| Case widgets | Long texts wrap correctly, without overlapping other content |
| Widgets | The image widget no longer offers `task:` fields it cannot show |
