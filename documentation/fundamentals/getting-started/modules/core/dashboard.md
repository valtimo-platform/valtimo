# Dashboard

This module contains the dashboard REST APIs and widget REST APIs. This module also provides code for a generic setup for widgets including some default out-of-the-box widgets.

## Dependencies

In order to use dashboard and widgets, the dashboard module needs to be added as a dependency. The following can be added to your project, depending on whether Maven or Gradle is used:

### Backend

The samples below assume the [valtimo-dependency-versions](valtimo-dependency-versions.md) module is used. If not, please specify the artifact version as well.

#### Maven dependency:

```xml
<dependencies>
    <dependency>
        <groupId>com.ritense.valtimo</groupId>
        <artifactId>dashboard</artifactId>
    </dependency>
</dependencies>
```

#### Gradle dependency:

```kotlin
dependencies {
  implementation("com.ritense.valtimo:dashboard")
}
```

### Frontend

```json
{
    "dependencies": {
        "@valtimo/dashboard": "<valtimo_frontend_version>"
    }
}
```
