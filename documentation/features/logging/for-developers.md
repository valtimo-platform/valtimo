---
icon: laptop-code
---

# For developers

{% hint style="info" %}
The for developers section within each feature gives more tech heavy information of configuring, extending or altering Valtimo via the codebase.
{% endhint %}

In the backend- and the frontend codebase configurations can be done in order to enable storage, cleanup and retention and enabling the menu item for viewing the logs.

## Backend

### Enabling storage

To enable storing the logs in the Valtimo database, a custom database appender has been implemented. This appender has to be configured in the logback-spring.xml configuration file:

```
<configuration scan="true">
    <include resource="config/logging/logback/valtimo-defaults.xml" />
    <include resource="org/springframework/boot/logging/logback/console-appender.xml" />
    <include resource="config/logging/logback/valtimo-database-appender.xml" />
    ...
    <root level="${logback.loglevel:-INFO}">
        <appender-ref ref="CONSOLE"/>
        <appender-ref ref="VALTIMODBASYNC"/>
    </root>
</configuration>
```

### REST client logging

Valtimo includes a `LoggingRestClientCustomizer` that automatically intercepts all outgoing HTTP requests made via
Spring's `RestClient`. When an external call returns an error status, the interceptor throws an
`HttpClientErrorException` with the status code and status text.

Detailed request and response information (method, URI, headers, and bodies) is logged at `DEBUG` level only. To enable
these detailed logs, add the following to your `logback-spring.xml`:

```xml
<logger name="com.ritense.valtimo.web.logging" level="DEBUG"/>
```

Alternatively, this can be configured via an environment variable without modifying `logback-spring.xml`:

```
LOGGING_LEVEL_COM_RITENSE_VALTIMO_WEB_LOGGING=DEBUG
```

Or as a Spring Boot application property:

```yaml
logging:
  level:
    com.ritense.valtimo.web.logging: DEBUG
```

{% hint style="warning" %}
**Security consideration:** DEBUG-level logs include full request and response bodies, which may contain sensitive
information such as authentication tokens, API keys, or personal data (e.g. BSN numbers). Only enable DEBUG logging
for this package in non-production environments or when actively troubleshooting an issue, and ensure log storage is
appropriately secured.
{% endhint %}

### Cleanup and retention

The following application properties can be set to configure the cleanup job time and the log retention period:

```
valtimo:
    logging:
        deletionCron: //Default 0 0 4 * * ?
        retentionInMinutes: //Default 30240
```

## Frontend

### Enabling the menu item

To show the logging menu item, the following property should be present in the Angular environment configuration:

```
menu: {
    menuItems: [
        {
            roles: [ROLE_ADMIN],
            title: 'Admin',
            iconClass: 'icon mdi mdi-tune',
            sequence: x,
            children: [
                {
                    link: ['/logging'], 
                    title: 'Logs', 
                    sequence: x
                }
            ]
        }
    ]
}
```
