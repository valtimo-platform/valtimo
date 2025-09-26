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

import {Injectable} from '@angular/core';
import {KeycloakAuthGuard, KeycloakService} from 'keycloak-angular';
import {ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot} from '@angular/router';
import {NGXLogger} from 'ngx-logger';

@Injectable({
  providedIn: 'root',
})
export class KeycloakAuthGuardService extends KeycloakAuthGuard implements CanActivate {
  constructor(
    protected router: Router,
    protected keycloakAngular: KeycloakService,
    private logger: NGXLogger
  ) {
    super(router, keycloakAngular);
    this.logger.debug('KeycloakAuthGuardService: ctor');
  }

  isAccessAllowed(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean> {
    this.logger.debug('KeycloakAuthGuardService: isAccessAllowed');
    return new Promise((resolve, reject) => {
      this.logger.debug('KeycloakAuthGuardService: isAccessAllowed checking access');
      if (!this.authenticated) {
        this.keycloakAngular
          .login()
          .catch(e => `KeycloakAuthGuardService error: ${this.logger.error(e)}`);
        return reject(false);
      }

      const requiredRoles: string[] = route.data.roles;

      if (!requiredRoles || requiredRoles.length === 0) {
        return resolve(true);
      }

      if (!this.roles || this.roles.length === 0) {
        resolve(false);
      }
      resolve(requiredRoles.some(role => this.roles.includes(role)));
    });
  }
}
