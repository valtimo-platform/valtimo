FROM eclipse-temurin:21-jdk-alpine

ARG SEMVER_VERSION
ADD build/libs/gzac-*.*.*.war /app.war

ENTRYPOINT ["java", "-jar", "/app.war"]