# REST API endpoint security test

## Smoke testing

Valtimo supports security smoke testing, which tests if all the REST API endpoints are properly secured. This test is called the `SecuritySmokeIntegrationTest`.

The following steps are required to run the `SecuritySmokeIntegrationTest`:

### Step 1: include the dependency

The test-utils-common dependency should be included in your project. More information can be found [here](../../fundamentals/getting-started/modules/core/test-utils-common.md).

### Step 2: create the security smoke test

Some custom code is needed to run the security smoke test. The code below shows how the `SecuritySmokeIntegrationTest` can be used to run the smoke test on a REST API endpoints in your application.

```kotlin
class MyProjectSecuritySmokeIntegrationTest : SecuritySmokeIntegrationTest {

    fun myProjectSecuritySmokeIntegrationTest() {
        super("com.mycompany.package", setOf(
                "GET /api/v1/open/exclude-this-endpoint/because-its-not-secured"
        ))
    }
}
```

### Step 3: run the 'security' tests

The security smoke tests and other security tests are all part of the test plan called 'security'. These tests have been given the tag 'security'. If you which to run the security tests separately from all other tests, you can create the following Gradle task:

```groovy
tasks.register("securityTesting", Test) {
    group = "verification"
    useJUnitPlatform {
        includeTags "security"
        excludeTags "integration"
    }
    mustRunAfter check
}
```

And execute that gradle task like this:

`./gradlew clean securityTesting`
