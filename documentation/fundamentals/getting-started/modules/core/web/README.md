# Web

Valtimo uses a client-side architecture where a Javascript component runs in the browser of a user (client). To fetch data and push changes this component communicates with a server-side component. The Valtimo Web module offers functionality to facilitate the communication between the client- and server-side component.

## Dependencies

In order to use web, the core module needs to be added as a dependency. For instructions on how to add the core module as a dependency, see [here](../core.md).

## Configuration

In order to run the web module, several properties can be configured. The bare minimum that has to be added to the application properties is the following:

#### **`application.yml`**

```yaml
valtimo:
  swagger:
    enabled: false
```

Information on how to configure Cross Origin Resource Sharing (CORS) in Valtimo can be found [here](valtimo-cors.md).
