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

import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {NGXLogger} from 'ngx-logger';
import {KeycloakOptionsService} from './keycloak-options.service';

@Component({
  selector: 'valtimo-keycloak-callback',
  template: ''
})
export class CallbackComponent {

  constructor(
    private router: Router,
    private keycloakOptionsService: KeycloakOptionsService,
    private logger: NGXLogger
  ) {
    logger.debug('callback');
    const savedRedirectTo = window.sessionStorage.getItem('redirectTo');
    let redirectTo;
    if (savedRedirectTo !== null) {
      redirectTo = window.sessionStorage.getItem('redirectTo');
    } else {
      redirectTo = '/';
    }
    logger.debug('keycloak callback redirect =', redirectTo);
    this.router.navigate([redirectTo]);
  }

}
