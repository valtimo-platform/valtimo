# Operaton

## Configuring Operaton webapps

By default, Valtimo includes the Operaton webapps, including the [cockpit](https://docs.operaton.org/docs/documentation/webapps/cockpit/). This is accessible by using the path `/operaton/app/` on the domain where Valtimo is hosted. e.g. `http://example.valtimo.com/operaton/app/`

### Configuring an admin user

The Operaton webapps use the default Operaton authentication mechanism. This means they cannot be accessed by keycloak users. Credentials can be configured in the default way Operaton provides when using Spring.

In order to create an admin user the following application configuration should be set:

```yaml
operaton.bpm.admin-user:
    id: admin # or another username of choice 
    password: # enter a newly generated password here
```

Note: The id (username) is unique. If you want to change the password, you can do it via the Operaton web interface: Dashboard => Users => Account

See the [Operaton documentation](https://docs.operaton.org/docs/documentation/user-guide/spring-boot-integration/configuration#operaton-engine-properties) for more configuration properties.

### Additional security

The Operaton webapps are available in a separate path (`/operaton/*`) from the other Valtimo APIs (`/api/*`). Since the Operaton webapps are a tool used to manage the internal it may be advisable to control access to this path on an infrastructure level.

To remove the Operaton webapps from Valtimo altogether the `org.operaton.bpm.springboot:operaton-bpm-spring-boot-starter-webapp:7.14.0` dependency can be excluded. This is a dependency in the Valtimo `core` module.
