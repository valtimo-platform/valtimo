## Welcome to the Valtimo backend

This folder contains:

- A collection of Java/Kotlin libraries that together form the Valtimo backend.
- The `app:gzac` module (see [its README](app/gzac/README.md)), containing the
  Spring Boot application. The module has a two-way source-set split:
  `src/main/` holds the template-equivalent production configuration that is
  packaged into the released `ritense/gzac-backend` image; `src/dev/` holds the
  developer-loop configuration (demo cases, dev `application.yml`, Ritense
  banner, test components). The split is gated by `-PincludeDev`.

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

| Command                                                       | Sources                | Notes                                                                                                                                                                                                                                                              |
|---------------------------------------------------------------|------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `./gradlew :backend:app:gzac:bootRunWithDocker`               | `src/main` + `src/dev` | Default for local dev. Auto-flips `-PincludeDev=true` because the task name matches. Starts Postgres / Keycloak / RabbitMQ via `docker-compose` first, then the Spring Boot app with the hardcoded dev config and demo data loaders.                                |
| `./gradlew :backend:app:gzac:bootRun`                         | `src/main` + `src/dev` | Same as above but assumes the supporting services are already running.                                                                                                                                                                                              |
| `./gradlew -PincludeDev=false :backend:app:gzac:bootRun`      | `src/main` only        | Boots the **template-equivalent** application: lean `config/application.yml`, GZAC banner, `processes.xml scan=true`, no demo content. Spring will fail on placeholder resolution unless the prod env vars (`SPRING_DATASOURCE_URL`, `SPRING_RABBITMQ_HOST`, `VALTIMO_PLUGIN_ENCRYPTIONSECRET`, etc.) are set — use this only for smoke-testing the prod resource path against a real environment. |
| `./gradlew -PincludeDev=false :backend:app:gzac:assemble`     | `src/main` only        | Produces `backend/app/gzac/build/libs/gzac-*.war` — the artifact CI's `build_type=production` matrix packages into the released image.                                                                                                                              |
| `./gradlew :backend:app:gzac:assemble`                        | `src/main` + `src/dev` | Produces the **test** image artifact (CI `build_type=test`): the dev console packaged as a WAR.                                                                                                                                                                     |

The `-PincludeDev` default is `true` in [`gradle.properties`](../gradle.properties)
so library/integration-test invocations also include dev sources. The release
image-build CI step passes `-PincludeDev=false` explicitly; see
[`.github/workflows/backend_build_push_docker_image.yml`](../.github/workflows/backend_build_push_docker_image.yml).

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
