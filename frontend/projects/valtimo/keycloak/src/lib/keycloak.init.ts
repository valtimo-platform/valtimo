/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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

import {KeycloakService} from 'keycloak-angular';
import {KeycloakOptionsService} from './keycloak-options.service';
import {Injector} from '@angular/core';
import {NGXLogger} from 'ngx-logger';
import {KeycloakUserService} from './keycloak-user.service';

export function keycloakInitializer(injector: Injector): () => Promise<any> {
  const keycloakService = injector.get<KeycloakService>(KeycloakService);
  const keycloakUserService = injector.get<KeycloakUserService>(KeycloakUserService);
  const optionsService = injector.get<KeycloakOptionsService>(KeycloakOptionsService); // TODO possible removal of abstraction
  const logger = injector.get<NGXLogger>(NGXLogger);

  return async (): Promise<any> => {
    try {
      logger.debug('Keycloak initializer before init');

      const keycloakOptions = optionsService.keycloakOptions;
      const currentUrl = window.location.href.split('#')[0];

      if (keycloakOptions.initOptions.redirectUri !== currentUrl) {
        const redirectTo = window.location.pathname;
        const urlSearchParams = new URLSearchParams(window.location.search);
        const params = Object.fromEntries(urlSearchParams.entries());
        logger.debug('Setting redirectTo =', redirectTo);
        window.sessionStorage.setItem('redirectTo', redirectTo);
        window.sessionStorage.setItem('redirectToParams', JSON.stringify(params));
      }

      const initResult = await keycloakService.init(keycloakOptions);
      logger.debug('Keycloak initializer after init');

      keycloakUserService.init();

      return initResult;
    } catch (error) {
      logger.debug('Keycloak initializer error', error);
      throw error;
    }
  };
}
