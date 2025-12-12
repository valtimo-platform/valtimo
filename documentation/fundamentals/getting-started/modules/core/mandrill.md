# Mandrill

## Dependencies

In order to send emails with the Mandrill API, the Mandrill module needs to be added as a dependency. The following can be added to your project, depending on whether Maven or Gradle is used:

### Backend

The samples below assume the [valtimo-dependency-versions](valtimo-dependency-versions.md) module is used. If not, please specify the artifact version as well.

#### Maven dependency:

```xml
<dependencies>
    <dependency>
        <groupId>com.ritense.valtimo</groupId>
        <artifactId>mandrill</artifactId>
    </dependency>
</dependencies>
```

#### Gradle dependency:

```kotlin
dependencies {
  implementation("com.ritense.valtimo:mandrill")
}
```

## Configuration

In order to run the Haalcentraal BRP module, several properties can be configured. The bare minimum that has to be added to the application properties is the following:

#### **`application.yml`**

```yaml
valtimo:
  mandrill:
    api-key:
    api-test-key:
    date-format:
    notification-template:
    completion-template:
    webhook-authentication-key:
    webhook-url:
```
