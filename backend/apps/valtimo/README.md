# Valtimo (backend)

The base **Valtimo** application — the process-automation platform without the
GZAC case-management additions. This is the application published as the
official `ritense/valtimo-backend` release.

## How to start

From the repository root:

```bash
./gradlew :backend:apps:valtimo:bootRunWithDocker
```

This starts the supporting services in Docker and then launches the
application. For day-to-day development with demo data, use the
[developer console](../dev/README.md) instead.
