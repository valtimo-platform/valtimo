# CORS

Cross Origin Resource Sharing, aka CORS, is a mechanism to allow access from Javascript resources in the browser to fetch resources from different domains then the Javascript is served from. By default, browsers only allow Javascript to fetch resources from the same domain.

The Valtimo Web module offers functionality to configure CORS in the application.properties file of the Valtimo Implementation project. The following example shows the used parameters with specific domain names for the origin and wildcards for the allowed methods and headers:

```yaml
valtimo:
  web:
    cors:
      corsConfiguration:
        allowedOrigins:
          - http://localhost:8000
          - https://example.valtimowebsites.net
        allowedMethods:
          - "*"
        allowedHeaders:
          - "*"
```
