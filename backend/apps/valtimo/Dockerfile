FROM eclipse-temurin:21-jre-noble

ADD build/libs/valtimo-*.war /app.war

ENTRYPOINT ["java", "-jar", "/app.war"]
