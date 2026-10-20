# Target layout

```markdown
# 13.49.0

Release date: 07-10-2026

---

## New Features

### Short title

One or two sentences.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Dashboard | Donut charts with many categories display the circle correctly |
```

- A `---` line goes between sections, never between entries.
- New Features and Enhancements: a `### Title` heading plus its text. Add the entry at the end of the
  section.
- Bugfixes: one table row, `| Area | Fix |`, sorted alphabetically by Area. Put a row next to rows
  with the same Area, after them.
- Security: one table row, `| Severity | Fix |`, sorted Critical, High, Medium, Low.
- A section you create starts with its `---` line, and Bugfixes or Security also with the table
  header and its `|------|-----|` line.
- Placeholders from the release cut: `### New feature title` with `New feature explanation.`,
  `### New enhancement title` with `New enhancement explanation.`, and the row
  `| Area name | New bugfix. |`. Replace the placeholder in the section you add to. Leave the other
  placeholders alone.
