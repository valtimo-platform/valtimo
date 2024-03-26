/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {NGXLogger} from 'ngx-logger';
import {KeycloakOptionsService, KeycloakStorageService} from './services';
import {STORAGE_KEYS} from './constants';

@Component({
  selector: 'valtimo-keycloak-callback',
  template: '',
})
export class CallbackComponent {
  constructor(
    private router: Router,
    private keycloakOptionsService: KeycloakOptionsService,
    private logger: NGXLogger,
    private readonly keycloakStorageService: KeycloakStorageService
  ) {
    logger.debug('callback');
    const savedRedirectTo = window.sessionStorage.getItem(STORAGE_KEYS.redirectTo);
    const savedRedirectToParams = window.sessionStorage.getItem(STORAGE_KEYS.redirectToParams);
    const parsedSavedRedirectToParams =
      this.keycloakStorageService.parseSavedParams(savedRedirectToParams);

    const urlBeforeExpiration = sessionStorage.getItem(STORAGE_KEYS.urlBeforeExpiration);
    const paramsBeforeExpiration = sessionStorage.getItem(STORAGE_KEYS.urlBeforeExpirationParams);
    const parsedParamsBeforeExpiration =
      this.keycloakStorageService.parseSavedParams(paramsBeforeExpiration);

    let redirectTo!: string;

    if (savedRedirectTo) {
      redirectTo = savedRedirectTo;
    } else {
      redirectTo = '/';
    }

    logger.debug('keycloak callback redirect =', redirectTo);
    logger.debug('keycloak callback redirect params =', savedRedirectToParams);

    if (STORAGE_KEYS.urlBeforeExpiration in sessionStorage) {
      this.router.navigate([urlBeforeExpiration], {queryParams: parsedParamsBeforeExpiration});
      sessionStorage.removeItem(STORAGE_KEYS.urlBeforeExpiration);
      sessionStorage.removeItem(STORAGE_KEYS.urlBeforeExpirationParams);
    } else {
      this.router.navigate([redirectTo], {queryParams: parsedSavedRedirectToParams});
    }
  }
}
