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

import {Component, OnInit} from '@angular/core';
import {NGXLogger} from 'ngx-logger';
import {Auth0UserService} from '../auth0-user.service';

declare var $;

@Component({
  selector: 'valtimo-session-expired-popup',
  templateUrl: './session-expired-popup.component.html',
  styleUrls: ['./session-expired-popup.component.scss']
})
export class SessionExpiredPopupComponent implements OnInit {

  constructor(
    private logger: NGXLogger,
    public auth0UserService: Auth0UserService
  ) {
  }

  ngOnInit() {
    this.logger.info('session expired');
    $('#sessionExpiredModal').modal({
      show: true,
      backdrop: 'static',
      keyboard: false
    });
  }
}

