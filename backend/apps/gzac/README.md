# GZAC (backend)

The standard **GZAC** application — the reference setup for Dutch case-based
working (Zaakgericht Werken). This is the application published as the official
`ritense/gzac-backend` release.

## How to start

From the repository root:

```bash
./gradlew :backend:apps:gzac:bootRunWithDocker
```

This starts the supporting services in Docker and then launches the
application. For day-to-day development with demo data, use the
[developer console](../dev/README.md) instead.
