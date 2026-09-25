# 13.48.0

Release date: 30-09-2026

---

## New Features

### Add a trefwoord to an existing document from a process

A new Documenten API plugin action, **Add trefwoord to document**, adds a trefwoord (keyword) to a
document that already exists, from any point in a process. Unlike the trefwoorden set when a
document is created, this action can run on a document at any later step, for example right after
a document has been sent somewhere, so the outcome is visible as a trefwoord in the document
overview afterwards. Running the action again with the same trefwoord does nothing, so it is safe
to place after a step that can retry.

{% hint style="info" %}
The Documenten API version configured for the plugin must support trefwoorden for this action to
be available.
{% endhint %}

---

## Enhancements

### New enhancement title

New enhancement explanation.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Area name | New bugfix. |
