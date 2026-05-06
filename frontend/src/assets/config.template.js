/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

(function (window) {
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
  window['env']['caseFileSizeUploadLimitMB'] = '${CASE_FILE_SIZE_UPLOAD_LIMIT_MB}';
  window['env']['featureToggles'] = window['env']['featureToggles'] || {};
  window['env']['featureToggles']['enableObjectManagement'] = '${ENABLE_OBJECT_MANAGEMENT}';
})(this);
