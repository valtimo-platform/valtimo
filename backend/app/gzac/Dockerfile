FROM openjdk:21-bullseye

ARG SEMVER_VERSION
ADD build/libs/gzac-*.*.*.war /app.war

ENTRYPOINT ["java", "-agentlib:jdwp=transport=dt_socket,server=y,address=*:8000,suspend=n", "-jar", "/app.war"]