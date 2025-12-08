# Configuring the database

Valtimo supports MySQL and PostgreSQL, and can be configured to make use of either one of these.

## How to configure Valtimo to use a particular DBMS

To determine the database type, the following property needs to be set in the application configuration:

```yaml
valtimo:
    database: postgres # or mysql
```

In addition, make sure the camunda database type does not conflict with the setting above. This setting is optional, and if not present, the value provided for `valtimo.database` will be used.

```yaml
camunda:
  bpm:
    database:
      type: postgres # or mysql
```
