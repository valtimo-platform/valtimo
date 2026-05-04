## Welcome to the Valtimo backend

This folder contains:

- A collection of Java/Kotlin libraries that together form the Valtimo backend.
- The `app:gzac` module, containing a Spring Boot application, used for development.

### Starting the Valtimo platform
Starting up the Valtimo platform requires two steps:
1. Starting the Valtimo backend. Instructions can be found [here](#starting-the-valtimo-backend-from-source).
2. Starting the Valtimo frontend. Instructions can be found [here](../frontend/README.md#starting-the-valtimo-frontend-from-source)

### Starting the Valtimo backend from source
#### Prerequisites
- Java 21
- [Docker (Desktop)](https://www.docker.com/products/docker-desktop/)
- (Optional) An IDE like [IntelliJ](https://www.jetbrains.com/idea/download/) or [Eclipse](https://www.eclipse.org/downloads/)

#### Start Application
Run the following command to start the Spring Boot application: `./gradlew :app:gzac:bootRunWithDocker`.

### Test users
Keycloak management can be accessed on http://localhost:8081 with the default credentials of username <ins>admin</ins> and password <ins>admin</ins>.

Keycloak comes preconfigured with the following users.

| Name         | Role           | Username  | Password  |
|--------------|----------------|-----------|-----------|
| James Vance  | ROLE_USER      | user      | user      |
| Asha Miller  | ROLE_ADMIN     | admin     | admin     |
| Morgan Finch | ROLE_DEVELOPER | developer | developer |

### Code quality
#### Running tests
- Run the following command to run the unit tests: `./gradlew test`.
- Run the following command to run the integration tests using a PostgreSQL database: `./gradlew integrationTestingPostgresql`.
- Run the following command to run the integration tests using a MySQL database: `./gradlew integrationTestingMysql`.
- Run the following command to run the security tests: `./gradlew securityTesting`.

#### Code guidelines
<!--- TODO: write the coding guidelines--->
For contributing code, please refer to the [backend coding](CODING-GUIDELINES.md).
