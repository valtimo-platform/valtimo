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

import {Injectable} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot} from '@angular/router';
import {NGXLogger} from 'ngx-logger';
import {Auth0UserService} from './auth0-user.service';
import {first} from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class Auth0AuthGuardService implements CanActivate {
  constructor(
    protected router: Router,
    protected auth0UserService: Auth0UserService,
    private logger: NGXLogger
  ) {
    this.logger.debug('Auth0AuthGuardService: ctor');
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean> {
    return this.isAccessAllowed(route, state);
  }

  isAccessAllowed(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean> {
    this.logger.debug('Auth0AuthGuardService: isAccessAllowed', route.data);
    return new Promise((resolve, reject) => {
      this.auth0UserService
        .getUserSubject()
        .pipe(first()) // One time sub only
        .subscribe(user => {
          const requiredRoles: string[] = route.data.roles;
          this.logger.debug('Route: requiredRoles', requiredRoles);
          if (user.roles != null) {
            if (!requiredRoles || requiredRoles.length === 0) {
              this.logger.debug('Access allowed: reason no roles required');
              return resolve(true);
            } else {
              if (!user.roles || user.roles.length === 0) {
                this.logger.debug('Access not-allowed: reason user has no roles');
                resolve(false);
              }
              const rolesAccess = requiredRoles.every(role => user.roles.indexOf(role) > -1);
              this.logger.debug('Access by route role match?', rolesAccess);
              resolve(requiredRoles.every(role => user.roles.indexOf(role) > -1));
            }
          }
        });
    });
  }
}
