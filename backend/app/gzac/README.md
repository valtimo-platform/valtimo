# `backend/app/gzac`

The Spring Boot application module. Two source sets share the same Gradle
project:

| Source set    | Contents                                                                                                                                                                                                                                                                                          | When it's on the classpath                                                                                  |
|---------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| `src/main/`   | Byte-for-byte equivalent of `~/Projects/gzac-backend-template/src/main`. Carries `com.ritense.valtimo.Application`, the prod `config/application.yml` (env-driven), `config/pbac/all.role.json`, `META-INF/spring/...AutoConfiguration.imports`, lean prod `logback-spring.xml`, GZAC `banner.txt`, `processes.xml` with `scan="true"`. | Always. This is what the released `ritense/gzac-backend` Docker image packages. |
| `src/dev/`    | The developer-loop configuration that used to live in `src/main/` before the source-set split: `com.ritense.gzac.GzacApplication` (with `@EnableScheduling`, `@EnableSchedulerLock`, `@EnableProcessApplication`), hardcoded dev `application.yml`, demo cases under `config/case/**`, dashboards, BezwaarAdHocFvm components, TestImpl security configurer, `notification-test` listener, dev `logback-spring.xml`, Ritense banner, `processes.xml scan="false"`. | Only when `-PincludeDev=true`. |

## Switching variants

`-PincludeDev` controls the split. The default in
[`gradle.properties`](../../../gradle.properties) is `true` (so library tests,
integration tests, and `assemble` all include dev). Two automatic overrides
are baked into [`build.gradle`](./build.gradle):

- If the Gradle task name contains `bootRun` or `bootRunWithDocker`, the dev
  sources are auto-included (no `-PincludeDev` flag required) and
  `springBoot.mainClass` is pinned to `com.ritense.gzac.GzacApplicationKt`.
- Otherwise `springBoot.mainClass` is pinned to
  `com.ritense.valtimo.ApplicationKt` (the template's class).

CI's release-image build path passes `-PincludeDev=false` explicitly
([`.github/workflows/backend_build_push_docker_image.yml`](../../../.github/workflows/backend_build_push_docker_image.yml)
line 57) so the production matrix entry packages only `src/main`.

When both source sets are on the classpath, dev resources win on path
collisions (e.g. both source sets carry `META-INF/processes.xml`,
`config/application.yml`, `logback-spring.xml`, `banner.txt`). The build
sets `processResources.duplicatesStrategy = DuplicatesStrategy.INCLUDE` so
the later-added `src/dev/resources` directory overwrites `src/main/resources`
during the resources-copy step.

## Common commands

| Command                                                       | Effect                                                                                  |
|---------------------------------------------------------------|-----------------------------------------------------------------------------------------|
| `./gradlew :backend:app:gzac:bootRunWithDocker`               | Start docker-compose dependencies, then run the dev console (includeDev auto-on).        |
| `./gradlew :backend:app:gzac:bootRun`                         | Same as above but assumes dependencies are already up.                                  |
| `./gradlew -PincludeDev=false :backend:app:gzac:bootRun`      | Boot the template-equivalent app. Requires the prod env vars or a populated `.env.properties` — Spring will not start without them. |
| `./gradlew -PincludeDev=false :backend:app:gzac:assemble`     | Build `build/libs/gzac-*.war` containing only `src/main` (the released artifact).        |
| `./gradlew :backend:app:gzac:assemble`                        | Build the CI "test" WAR (`build_type=test`): dev sources merged in.                      |

## `.env.properties`

`bootRun` and `bootRunWithDocker` load `backend/app/gzac/.env.properties` (if
present) into the JVM environment before starting. Use this to supply the env
vars that the `-PincludeDev=false` config path requires (`SPRING_DATASOURCE_URL`,
`SPRING_RABBITMQ_HOST`, `VALTIMO_APP_HOSTNAME`, `VALTIMO_PLUGIN_ENCRYPTIONSECRET`,
the OAuth2 issuer URIs, etc.). Not required when using the default dev path.
