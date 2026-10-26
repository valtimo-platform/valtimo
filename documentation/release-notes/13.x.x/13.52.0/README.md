# 13.52.0

Release date: 28-10-2026

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
