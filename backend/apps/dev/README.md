# Developer console (backend)

The application used for **local development**. It comes with demo cases and
sample data already set up, so you can explore Valtimo without configuring
anything. This is the one to run while working on the platform.

## How to start

From the repository root:

```bash
./gradlew :backend:apps:dev:bootRunWithDocker
```

This starts the supporting services (database, Keycloak, message broker, …) in
Docker and then launches the application. Once it's up, start one of the
frontend apps to use it in the browser.
