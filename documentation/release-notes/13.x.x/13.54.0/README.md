# 13.54.0

Release date: 11-11-2026

---

## New Features

### New feature title

New feature explanation.

---

## Enhancements

### New enhancement title

New enhancement explanation.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Dashboard | A long dashboard widget subtitle is now cut off with ellipsis instead of running out of the widget, and the full title and subtitle show on hover. |

---

## Security

| Severity | Fix |
|----------|-----|
| High | The Objecten API plugin only sends requests to object URLs that belong to the Objecten API it is configured with. Before, a user allowed to modify objects could make Valtimo send a request, including the Objecten API credentials, to another server. If your Objecten API returns object URLs with a different host, port or path than the URL in the plugin configuration, update the plugin configuration to match, otherwise those objects can no longer be opened, changed or deleted. |
