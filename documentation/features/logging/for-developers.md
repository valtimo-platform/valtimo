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
