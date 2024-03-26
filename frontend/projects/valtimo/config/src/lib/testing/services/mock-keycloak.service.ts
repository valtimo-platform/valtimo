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
import {Observable, of} from 'rxjs';
import {KeycloakProfile} from 'keycloak-js';

@Injectable({
  providedIn: 'root',
})
export class MockKeycloakService {
  public get keycloakEvents$(): Observable<{type: string}> {
    return of({type: ''});
  }

  public isLoggedIn(): Observable<boolean> {
    return of(true);
  }

  private readonly MOCK_USER_PROFILE: KeycloakProfile = {
    id: '',
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    enabled: true,
    emailVerified: true,
    totp: true,
    createdTimestamp: 0,
  };

  public async loadUserProfile(): Promise<KeycloakProfile> {
    return this.MOCK_USER_PROFILE;
  }
}
