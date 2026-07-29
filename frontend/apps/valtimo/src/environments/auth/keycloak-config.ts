import {KeycloakAuthGuardService, keycloakInitializer, KeycloakModule, KeycloakUserService, ValtimoKeycloakOptions} from '@valtimo/keycloak';
import {KeycloakConfig, KeycloakOnLoad} from 'keycloak-js';
import {Injector} from '@angular/core';
import {Auth, AuthProviders} from '@valtimo/config';

const keycloakAuthenticationProviders: AuthProviders = {
  guardServiceProvider: KeycloakAuthGuardService,
  userServiceProvider: KeycloakUserService
};

export const keycloakConfig: KeycloakConfig = {
  url: window['env']['keycloakUrl'] || 'http://localhost:8081/auth',
  realm: window['env']['keycloakRealm'] || 'valtimo',
  clientId: window['env']['keycloakClientId'] || 'valtimo-console'
};

const keycloakOnLoad: KeycloakOnLoad = 'login-required';

const keycloakInitOptions: any = {
  config: keycloakConfig,
  onLoad: keycloakOnLoad,
  checkLoginIframe: false,
  flow: 'standard',
  redirectUri: window['env']['keycloakRedirectUri'] || 'http://localhost:4200/keycloak/callback'
};

const valtimoKeycloakOptions: ValtimoKeycloakOptions = {
  keycloakOptions: {
    config: keycloakConfig,
    initOptions: keycloakInitOptions,
    enableBearerInterceptor: true,
    // Presigned S3 upload URLs must not receive the Keycloak bearer token: the extra
    // Authorization header breaks the SigV4 signature and leaks the token to the storage
    // host. Exclude both S3 hosts we may issue presigned URLs for (AWS and OVHcloud).
    bearerExcludedUrls: [
      '/assets',
      '^https?://[^/]+\\.amazonaws\\.com/',
      '^https?://[^/]+\\.io\\.cloud\\.ovh\\.net/'
    ]
  },
  logoutRedirectUri: window['env']['keycloakLogoutRedirectUri'] || 'http://localhost:4200'
};

export function initializerKeycloak(injector: Injector) {
  return keycloakInitializer(injector);
}

export const authenticationKeycloak: Auth = {
  module: KeycloakModule,
  initializer: initializerKeycloak,
  authProviders: keycloakAuthenticationProviders,
  options: valtimoKeycloakOptions
};
