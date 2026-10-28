# 13.52.0

Release date: 28-10-2026

{% hint style="warning" %}
This release contains security fixes. See [Security](#security) for details.
{% endhint %}

---

## New Features

### New feature title

New feature explanation.

---

## Enhancements

### More reliable JavaScript results

Values returned by JavaScript in process scripts and decision tables now stay usable after the script has finished. Lists, sets and key-value maps returned by a script keep their contents; previously some of them came back empty.

Lists and maps that a script fills with its own objects now also stay readable after the script has finished. They come back as copies made of plain data. Very large results stop the script with a clear error.

**Hint:** objects a script puts into existing data without returning it are not converted. Return the value or store it as a process variable.

**Behaviour change:** a script must return plain data, such as text, numbers, dates, lists or objects. Scripts that return something else, for example a function or a promise, now stop with a clear error message instead of silently returning an unusable value. Check scripts that return such values and change them to return plain data.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Forms | Clicking the submit button of a form more than once no longer submits the form multiple times; after a failed submit the button can be used again. |
| Processes | A boundary error event now catches a BPMN error thrown by a plugin, also inside a building block. |
| Scripts | Running JavaScript in processes and decision tables no longer makes the application use more and more memory over time. Scripts also run faster. |
| Widgets | A widget display condition with a number value, such as `0`, now compares numerically against a number field. The `${0}` workaround is no longer needed. |

---

## Security

| Severity | Fix |
|----------|-----|
| High | A JavaScript script task or decision table expression can no longer get around the list of classes it is allowed to use, and so can no longer reach the rest of the application or the server it runs on |
| High | The process instance search and count endpoints no longer let any logged-in user list the process instances of all cases or search their process variables. They are now only available to administrators. The search endpoints and the count by process definition name will be removed in a future version. |
| Medium | Adding a comment to a process instance is now only available to administrators, and will be removed in a future version. |
| Medium | Deploying a version of a process definition with shortened timers is now only available to administrators, and will be removed in a future version. |
| Low | A process or decision variable can no longer influence the restrictions that apply to JavaScript, either during its own run or during later ones |

{% hint style="warning" %}
Scripts can no longer use the `engine` and `context` objects that the script engine previously
made available. These were never part of the supported scripting interface. A script that uses
one of them now fails and must be rewritten using process variables or `execution`.
{% endhint %}
