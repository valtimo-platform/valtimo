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

import {ModuleWithProviders, NgModule} from '@angular/core';
import {CallbackComponent} from './callback.component';
import {Auth0RoutingModule} from './auth0-routing.module';
import {JwtAuthService} from './jwt-auth.service';
import {JwtModule} from '@auth0/angular-jwt';
import {SessionExpiredPopupComponent} from './session-expired-popup/session-expired-popup.component';

export function jwtTokenGetter() {
  return localStorage.getItem(JwtAuthService.TOKEN);
}

@NgModule({
  declarations: [CallbackComponent, SessionExpiredPopupComponent],
  imports: [Auth0RoutingModule, JwtModule],
  exports: [CallbackComponent, SessionExpiredPopupComponent],
})
export class Auth0Module {
  static forRoot(allowedDomains: string[]): ModuleWithProviders<Auth0Module> {
    return {
      ngModule: Auth0Module,
      providers: [
        JwtModule.forRoot({
          config: {
            tokenGetter: jwtTokenGetter,
            allowedDomains: allowedDomains,
          },
        }).providers,
      ],
    };
  }
}
