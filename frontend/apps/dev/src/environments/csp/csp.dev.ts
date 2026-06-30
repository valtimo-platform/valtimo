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

import {CSPHeaderParams, DATA, SELF, UNSAFE_EVAL, UNSAFE_INLINE, BLOB} from 'csp-header';
import {UrlUtils} from '@valtimo/config';
import {authenticationKeycloak} from '../auth/keycloak-config.dev';

export const cspHeaderParamsDev: CSPHeaderParams = {
  directives: {
    'default-src': [SELF],
    'img-src': [SELF, DATA],
    'script-src': [SELF, UNSAFE_EVAL, UNSAFE_INLINE, 'https://cdn.form.io/'],
    'worker-src': [SELF, BLOB],
    'font-src': [
      SELF,
      DATA,
      UNSAFE_INLINE,
      'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/',
      'https://fonts.gstatic.com',
    ],
    'connect-src': [
      SELF,
      UrlUtils.getUrlHost(authenticationKeycloak.options.keycloakOptions.config.url),
    ],
    'style-src': [
      SELF,
      UNSAFE_INLINE,
      'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/',
      'https://fonts.googleapis.com',
    ],
  },
};
