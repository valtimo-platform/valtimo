# Case OpenSearch

The case-opensearch module provides OpenSearch as an optional search backend for case lists and document queries.

For configuration and usage documentation, see [OpenSearch](../../../../running-valtimo/application-configuration/opensearch.md).

## Dependencies

### Backend

The samples below assume the [valtimo-dependency-versions](valtimo-dependency-versions.md) module is used. If not, please specify the artifact version as well.

#### Maven dependency:

```xml
<dependencies>
    <dependency>
        <groupId>com.ritense.valtimo</groupId>
        <artifactId>case-opensearch</artifactId>
    </dependency>
</dependencies>
```

#### Gradle dependency:

```kotlin
dependencies {
  implementation("com.ritense.valtimo:case-opensearch")
}
```

## Auto-configuration

The module provides `DocumentOpenSearchAutoConfiguration` which is enabled when `valtimo.opensearch.enabled=true`.
