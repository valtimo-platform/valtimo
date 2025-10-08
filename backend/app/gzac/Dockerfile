FROM openjdk:21-bullseye

ARG SEMVER_VERSION
ADD build/libs/gzac-*.*.*.war /app.war

ENTRYPOINT ["java", "-jar", "/app.war"]