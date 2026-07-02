FROM eclipse-temurin:21-jre-noble

ADD build/libs/dev-*.war /app.war

ENTRYPOINT ["java", "-jar", "/app.war"]
