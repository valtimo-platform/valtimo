## Welcome to the Valtimo backend

This folder contains:

- A collection of Java/Kotlin libraries that together form the Valtimo backend.
- Four runnable Spring Boot app modules under [`apps/`](apps/): `gzac`,
  `valtimo` and `evenementenvergunning` are the released applications (packaged
  into `ritense/gzac-backend`, `ritense/valtimo-backend` and
  `ritense/gzac-evenementenvergunning-backend`); [`dev`](apps/dev/README.md) is
  the developer console (demo cases, dev config, showcase components) used for
  the local `bootRun` loop and PR-CI test images. Each is a uniform
  single-source-set module; shared boilerplate lives in
  [`gradle/valtimo-app.gradle`](gradle/valtimo-app.gradle).

### Starting the Valtimo platform

Starting up the Valtimo platform requires two steps:

1. Starting the Valtimo backend. Instructions can be found [here](#starting-the-valtimo-backend-from-source).
2. Starting the Valtimo frontend. Instructions can be
   found [here](../frontend/README.md#starting-the-valtimo-frontend-from-source)

### Starting the Valtimo backend from source

#### Prerequisites

- Java 21
- [Docker (Desktop)](https://www.docker.com/products/docker-desktop/)
- (Optional) An IDE like [IntelliJ](https://www.jetbrains.com/idea/download/)
  or [Eclipse](https://www.eclipse.org/downloads/)

#### Start Application

| Command                                            | Notes                                                                                                                                                                                                                                                              |
|----------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `./gradlew :backend:apps:dev:bootRunWithDocker`    | Default for local dev. Starts Postgres / Keycloak / RabbitMQ via `docker-compose` first, then the developer console with the dev config and demo data.                                                                                                              |
| `./gradlew :backend:apps:dev:bootRun`              | Same as above but assumes the supporting services are already running.                                                                                                                                                                                              |
| `./gradlew :backend:apps:gzac:bootRunWithDocker`   | Boot the **released** gzac config against the shared stack — handy for smoke-testing the prod resource path. Spring will fail on placeholder resolution unless the prod env vars (`SPRING_DATASOURCE_URL`, `SPRING_RABBITMQ_HOST`, `VALTIMO_PLUGIN_ENCRYPTIONSECRET`, …) are supplied via a `.env.properties` or the environment. |
| `./gradlew :backend:apps:gzac:assemble`            | Produces `backend/apps/gzac/build/libs/gzac-*.war` — the released image artifact. (`valtimo` / `evenementenvergunning` build the same way.)                                                                                                                         |

Each app module is uniform: one source set, one `Application`, one image. The
shared `bootRunWithDocker` task, the docker-compose stack and the publish-disable
live in [`gradle/valtimo-app.gradle`](gradle/valtimo-app.gradle); the PR-CI
test-env image is the `dev` variant (see
[`.github/workflows/backend_build_push_docker_image.yml`](../.github/workflows/backend_build_push_docker_image.yml)).

### Test users

Keycloak management can be accessed on http://localhost:8081 with the default credentials of username <ins>admin</ins>
and password <ins>admin</ins>.

Keycloak comes preconfigured with the following users.

| Name         | Role           | Username  | Password  |
|--------------|----------------|-----------|-----------|
| James Vance  | ROLE_USER      | user      | user      |
| Asha Miller  | ROLE_ADMIN     | admin     | admin     |
| Morgan Finch | ROLE_DEVELOPER | developer | developer |

### Code quality

#### Running tests

- Run the following command to run the unit tests: `./gradlew test`.
- Run the following command to run the integration tests using a PostgreSQL database:
  `./gradlew integrationTestingPostgresql`.
- Run the following command to run the integration tests using a MySQL database: `./gradlew integrationTestingMysql`.
- Run the following command to run the security tests: `./gradlew securityTesting`.

#### Code guidelines

For contributing code, please refer to the [backend coding guidelines](CODING-GUIDELINES.md).
