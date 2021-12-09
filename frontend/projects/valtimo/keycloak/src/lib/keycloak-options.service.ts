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

import {ValtimoKeycloakOptions} from '@valtimo/contract';
import {Injectable} from '@angular/core';
import {ConfigService} from '@valtimo/config';

@Injectable({
  providedIn: 'root'
})
export class KeycloakOptionsService {

  private readonly valtimoKeycloakOptions: ValtimoKeycloakOptions;

  constructor(
    private configService: ConfigService
  ) {
    this.valtimoKeycloakOptions = configService.config.authentication.options;
  }

  get keycloakOptions() {
    return this.valtimoKeycloakOptions.keycloakOptions;
  }

  get logoutRedirectUri() {
    return this.valtimoKeycloakOptions.logoutRedirectUri;
  }

}
