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

**Behaviour change:** a script must return plain data, such as text, numbers, dates, lists or objects. Scripts that return something else, for example a function or a promise, now stop with a clear error message instead of silently returning an unusable value. Check scripts that return such values and change them to return plain data.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Scripts | Running JavaScript in processes and decision tables no longer makes the application use more and more memory over time. Scripts also run faster. |

---

## Security

| Severity | Fix |
|----------|-----|
| High | A JavaScript script task or decision table expression can no longer get around the list of classes it is allowed to use, and so can no longer reach the rest of the application or the server it runs on |
| Low | A process or decision variable can no longer influence the restrictions that apply to JavaScript, either during its own run or during later ones |

{% hint style="warning" %}
Scripts can no longer use the `engine` and `context` objects that the script engine previously
made available. These were never part of the supported scripting interface. A script that uses
one of them now fails and must be rewritten using process variables or `execution`.
{% endhint %}
