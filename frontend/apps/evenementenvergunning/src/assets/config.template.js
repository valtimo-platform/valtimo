(function(window) {
  window['env'] = window['env'] || {};

  // Environment variables
  window['env']['swaggerUri'] = '${SWAGGER_URI}';
  window['env']['mockApiUri'] = '${MOCK_API_URI}';
  window['env']['apiUri'] = '${API_URI}';
  window['env']['keycloakUrl'] = '${KEYCLOAK_URL}';
  window['env']['keycloakRealm'] = '${KEYCLOAK_REALM}';
  window['env']['keycloakClientId'] = '${KEYCLOAK_CLIENT_ID}';
  window['env']['keycloakRedirectUri'] = '${KEYCLOAK_REDIRECT_URI}';
  window['env']['keycloakLogoutRedirectUri'] = '${KEYCLOAK_LOGOUT_REDIRECT_URI}';
  window['env']['whiteListedDomain'] = '${WHITELISTED_DOMAIN}';
  window['env']['openZaakCatalogusId'] = '${OPENZAAK_CATALOGUS_ID}';
})(this);
