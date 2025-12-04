# Camunda

## Configuring camunda webapps

By default, Valtimo includes the Camunda webapps, including the [cockpit](https://camunda.com/platform-7/cockpit/). This is accessible by using the path `/camunda/app/` on the domain where Valtimo is hosted. e.g. `http://example.valtimo.com/camunda/app/`

### Configuring an admin user

The Camunda webapps use the default Camunda authentication mechanism. This means they cannot be accessed by keycloak users. Credentials can be configured in the default way Camunda provides when using Spring.

In order to create an admin user the following application configuration should be set:

```yaml
camunda.bpm.admin-user:
    id: admin # or another username of choice 
    password: # enter a newly generated password here
```

Note: The id (username) is unique. If you want to change the password, you can do it via the Camunda web interface: Dashboard => Users => Account

See the [camunda documentation](https://docs.camunda.org/manual/latest/user-guide/spring-boot-integration/configuration/#camunda-engine-properties) for more configuration properties.

### Additional security

The Camunda webapps are available in a separate path (`/camunda/*`) from the other Valtimo APIs (`/api/*`). Since the Camunda webapps are a tool used to manage the internal it may be advisable to control access to this path on an infrastructure level.

To remove the Camunda webapps from Valtimo altogether the `org.camunda.bpm.springboot:camunda-bpm-spring-boot-starter-webapp:7.14.0` dependency can be excluded. This is a dependency in the Valtimo `core` module.
