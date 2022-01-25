/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

import {Injector} from '@angular/core';
import {NGXLogger} from 'ngx-logger';
import * as auth0js from 'auth0-js';
import {ConfigService} from '@valtimo/config';
import {ValtimoAuth0Options} from '@valtimo/contract';
import {Auth0UserService} from './auth0-user.service';

export function auth0Initializer(injector: Injector): () => Promise<any> {
  const configService = injector.get<ConfigService>(ConfigService);
  const auth0UserService = injector.get<Auth0UserService>(Auth0UserService);
  const logger = injector.get<NGXLogger>(NGXLogger);

  return async (): Promise<any> => {
    try {
      logger.debug('Auth0 initializer before init');

      const valtimoAuth0Options: ValtimoAuth0Options = configService.config.authentication.options;

      const auth0jsInstance = new auth0js.WebAuth({
        clientID: valtimoAuth0Options.clientId,
        domain: valtimoAuth0Options.domain,
        responseType: valtimoAuth0Options.responseType,
        redirectUri: valtimoAuth0Options.redirectUri,
        scope: valtimoAuth0Options.scope,
      });
      auth0UserService.setAuth0JsInstance(auth0jsInstance);
      const currentUrl = window.location.href.split('#')[0];
      if (valtimoAuth0Options.redirectUri !== currentUrl) {
        const redirectTo = window.location.pathname;
        logger.debug('set redirectTo =', redirectTo);
        Auth0UserService.storeRedirectTo(redirectTo);
      }
      logger.debug('Auth0 initializer before init');
      await auth0UserService.login();
      logger.debug('Auth0 initializer after init');
      return true;
    } catch (error) {
      logger.debug('Auth0 initializer error', error);
      throw error;
    }
  };
}
