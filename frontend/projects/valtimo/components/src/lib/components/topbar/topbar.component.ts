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
import {KeycloakService} from 'keycloak-angular';
import {from, switchMap, map} from 'rxjs';
import {ConfigService} from '@valtimo/config';

@Component({
  selector: 'valtimo-topbar',
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.scss'],
})
export class TopbarComponent implements OnInit {
  showUserNameInTopBar!: boolean;

  readonly userFullName$ = from(this.keyCloakService.isLoggedIn()).pipe(
    switchMap(() => this.keyCloakService.loadUserProfile()),
    map(profile => `${profile.firstName} ${profile.lastName}`)
  );

  constructor(
    private readonly keyCloakService: KeycloakService,
    private readonly configService: ConfigService
  ) {}

  ngOnInit(): void {
    this.showUserNameInTopBar = this.configService.config.featureToggles?.showUserNameInTopBar;
  }
}
