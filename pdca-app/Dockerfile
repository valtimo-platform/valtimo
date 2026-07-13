FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY build/libs/pdca-app-0.1.0.jar app.jar
EXPOSE 8090
ENTRYPOINT ["java", "-jar", "app.jar"]
