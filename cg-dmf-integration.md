I need to setup CG-DMF-POC (also known as CG-DMF, DMF or DRC) as part of the Valtimo backend docker-compose configuration. The goal is that developers can simply run `docker compose up` within the Valito repo and have the full environment up and running. At the moment I have setup the main parts but I am stuck configuraring the correct values for the `OIDC_ISSUER` and `OIDC_RESOURCE_CLIENT_ID` environment variables as I don't have a clue which values I should enter.

My local instance of CG-DMF-POC runs with it's own Keycloak instance (started through local docker compose configuration and settings defined in .env file). However I am wondering if I should use the existing Valtimo keycloak instance and how to configure that. Preferably using only configuration so developers don't have to do additional steps to start the whole environment.

Feel free to read through the file locations and GitHub resources specified below.

## Source code locations

- Valtimo:
  - Local repo: /Users/maurits/sources/Baseflow/Customers/CommonGround/valtimo
  - Valtimo docker-compose.yaml (the file I am trying to configure): /Users/maurits/sources/Baseflow/Customers/CommonGround/valtimo/backend/app/gzac/docker-compose.yaml
  - Github location: https://github.com/valtimo-platform/valtimo
- CG-DMF:
  - Local repo: /Users/maurits/sources/Baseflow/Customers/CommonGround/cg-dmf-poc
  - Standalone CG-DMF-POC docker configuration:
    - docker-compose.yaml: /Users/maurits/sources/Baseflow/Customers/CommonGround/cg-dmf-poc/docker-compose.yml
    - docker-compose.override.yaml: /Users/maurits/sources/Baseflow/Customers/CommonGround/cg-dmf-poc/docker-compose.override.yml
    - .env configuration: /Users/maurits/sources/Baseflow/Customers/CommonGround/cg-dmf-poc/.env
  - Github location: https://github.com/baseflow/cg-dmf-poc
- Open Zaak:
  - Github repo: https://github.com/open-zaak/open-zaak
