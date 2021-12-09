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

import {Injectable, Injector} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivate, RouterStateSnapshot, UrlTree} from '@angular/router';
import {NGXLogger} from 'ngx-logger';
import {Observable} from 'rxjs';
import {ConfigService} from '@valtimo/config';

@Injectable({
  providedIn: 'root'
})
export class AuthGuardService implements CanActivate {

  private readonly authGuardServiceProvider: CanActivate;

  constructor(
    configService: ConfigService,
    private injector: Injector,
    protected logger: NGXLogger
  ) {
    this.authGuardServiceProvider = injector.get<any>(configService.config.authentication.authProviders.guardServiceProvider);
    this.logger.debug('Loading AuthGuardServiceProvider service', this.authGuardServiceProvider);
  }

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    this.logger.debug('Delegating AuthGuard canActivate');
    return this.authGuardServiceProvider.canActivate(route, state);
  }

}
