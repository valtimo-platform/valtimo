# 13.43.0

Release date: 26-08-2026

---

## New Features

### Exporting and importing a process with everything it uses

A process that is not part of a case can now be exported together with its process links **and the
elements it references** — the called sub-processes, decision tables and forms — and imported on
another environment. This is the same as exporting a case definition: the package is complete, so a
process that is moved works on the target environment without recreating those elements by hand.
Use *Export* in the menu of the process to download a package, and upload that package on the
target environment. (*Export BPMN definition* in the same menu still downloads only the BPMN file.)

During the import you can point every plugin link in the package at the plugin configuration of
the target environment, so links keep working on an environment that uses different configurations.

One thing is deliberately not part of the package: form flow definitions. A form flow belongs to a
case or building block and moves with it, so it cannot be attached to a process outside a case.

Uploading a single BPMN file keeps working as before.

---

## Enhancements

### An exported process describes itself

The package of an exported process now contains a manifest, just like an exported case definition or
building block already did. It names the process, its version, and the plugins its process links
need, so it is clear what a package contains and what the receiving environment has to offer before
it is imported.

### The import preview shows what will be replaced

Because the package now includes the elements the process references, importing it can update an
element that already exists on the target and is shared with other processes. Before importing, the
preview therefore lists which existing processes, decision tables and forms the import will replace,
so replacing them is a conscious choice.

If a process refers to a sub-process or decision table through a dynamic or deployment binding, that
element cannot be included in the package. The preview names those separately, so it is clear they
have to be imported on their own. A process that references a decision table or sub-process that is
missing altogether cannot be exported, so a broken package is never produced.

### A process that is managed by configuration cannot be overwritten by an import

Importing a package for a process that exists on this environment as a system process that may not
be changed is refused, with an explanation. Such a process can still be exported.

### Process links from the application configuration are leading

Process links that are supplied with the application configuration are now leading: a link that is
not in that configuration is removed when the application starts. This keeps environments that are
managed through configuration identical to that configuration.

### Case definition key and version in case inspection

The metadata tab of the case inspection page now displays the case definition key and version. This
makes it clear which version of a case definition a case belongs to.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Process editor | Exporting a process definition produced a file named `diagram.bpmn`; it is now named after the process, so it is clear which process was exported |
| Process upload | The file dialog filters on the supported file types again, and dragging a file onto the upload area works again — for BPMN files as well as exported process packages |
| Draft environments | Default Spring profiles now correctly enable draft mode |
| Search fields | Date searches return results with correct date format |
| Document schemas | Recursive schema references no longer crash the server |
| Cases | A case that cannot be found no longer stops a process, an assignment or a note |
| Dashboard | Donut charts with many categories display the circle correctly |
| Notificaties API | Subscription registration no longer causes a restart loop on startup |
| Case export | Forms shown in a widget are included in the case export |
