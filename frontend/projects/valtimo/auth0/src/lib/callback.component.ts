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
import {Auth0UserService} from './auth0-user.service';
import {NGXLogger} from 'ngx-logger';
import {Router} from '@angular/router';

@Component({
  selector: 'valtimo-auth0-callback',
  template: ''
})
export class CallbackComponent {

  constructor(
    private auth0UserService: Auth0UserService,
    private logger: NGXLogger,
    private router: Router
  ) {
    this.logger.debug('valtimo-auth0-callback');
    const redirect = auth0UserService.determineRedirect();
    logger.debug('redirecting to', redirect);
    router.navigate([redirect]);
    logger.debug('redirecting done', redirect);
  }

}
