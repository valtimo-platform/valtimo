# GZAC (backend)

The **GZAC** application — the reference setup for Dutch case-based working
(Zaakgericht Werken), released as `ritense/gzac-backend`. Template-equivalent
production configuration only; the developer console lives in
[`backend/app/dev`](../dev/README.md).

## How to start

With the supporting services already running, from the repository root:

```bash
./gradlew :backend:app:gzac:bootRun
```

For day-to-day development with demo data, use the
[developer console](../dev/README.md) instead.
