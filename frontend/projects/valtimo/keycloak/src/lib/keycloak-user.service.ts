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
import {ReplaySubject} from 'rxjs';
import {NGXLogger} from 'ngx-logger';
import {KeycloakService} from 'keycloak-angular';
import {UserIdentity, UserService, ValtimoUserIdentity} from '@valtimo/contract';
import {KeycloakOptionsService} from './keycloak-options.service';

@Injectable({
  providedIn: 'root',
})
export class KeycloakUserService implements UserService {
  private userIdentity: ReplaySubject<UserIdentity>;

  constructor(
    private keycloakService: KeycloakService,
    private keycloakOptionsService: KeycloakOptionsService,
    private logger: NGXLogger
  ) {}

  init(): void {
    this.userIdentity = new ReplaySubject();
    this.keycloakService.loadUserProfile().then(user => {
      this.logger.debug('KeycloakUserService: loadUserProfile = ', user);
      const roles: Array<string> = [];
      this.keycloakService.getUserRoles(true).forEach(role => roles.push(role));
      const valtimoUserIdentity = new ValtimoUserIdentity(
        user.email,
        user.firstName,
        user.lastName,
        roles,
        user.username
      );
      this.logger.debug('KeycloakUserService: loaded user identity', valtimoUserIdentity);
      this.userIdentity.next(valtimoUserIdentity);
    });
  }

  getUserSubject(): ReplaySubject<UserIdentity> {
    this.logger.debug('KeycloakUserService: getUserIdentity');
    return this.userIdentity;
  }

  logout(): void {
    this.logger.debug('KeycloakUserService: logout');
    this.keycloakService.logout(this.keycloakOptionsService.logoutRedirectUri);
  }

  async getToken(): Promise<string> {
    this.logger.debug('KeycloakUserService: getToken');
    return this.keycloakService.getToken();
  }

  async updateToken(minValidity: number): Promise<boolean> {
    this.logger.debug('KeycloakUserService: updateToken');
    return this.keycloakService.updateToken(minValidity);
  }
}
