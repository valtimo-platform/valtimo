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

import {Auth, AuthProviders} from '@valtimo/config';
import {
  Auth0AuthGuardService,
  auth0Initializer,
  Auth0Module,
  Auth0UserService,
  ValtimoAuth0Options,
} from '@valtimo/auth0';

export const valtimoAuth0Options: ValtimoAuth0Options = {
  clientId: '',
  domain: '',
  redirectUri: '',
  responseType: 'token id_token',
  scope: 'openid profile',
};

export const auth0AuthenticationProviders: AuthProviders = {
  guardServiceProvider: Auth0AuthGuardService,
  userServiceProvider: Auth0UserService,
};

export const authenticationAuth0: Auth = {
  module: Auth0Module.forRoot(['']),
  initializer: auth0Initializer,
  authProviders: auth0AuthenticationProviders,
  options: valtimoAuth0Options,
};
