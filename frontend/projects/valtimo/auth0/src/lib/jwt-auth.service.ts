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
import {NGXLogger} from 'ngx-logger';
import {JwtHelperService} from '@auth0/angular-jwt';

@Injectable({
  providedIn: 'root'
})
export class JwtAuthService {

  public static readonly TOKEN = 'token';

  private expiresAt: Date;

  constructor(
    private logger: NGXLogger,
    private jwtHelperService: JwtHelperService
  ) {
    this.expiresAt = this.getTokenExpirationDate();
  }

  getToken(): string | null {
    return localStorage.getItem(JwtAuthService.TOKEN);
  }

  getTokenExpirationDate(): Date {
    const localTokenExpirationDate = this.jwtHelperService.getTokenExpirationDate(this.getToken());
    const tokenExpirationDate = localTokenExpirationDate || new Date();
    this.logger.debug('getTokenExpirationDate', tokenExpirationDate);
    return tokenExpirationDate;
  }

  storeToken(jwtToken: string): void {
    this.logger.debug('storeToken');
    localStorage.setItem(JwtAuthService.TOKEN, jwtToken);
  }

  removeToken(): void {
    this.logger.debug('removeToken');
    localStorage.removeItem(JwtAuthService.TOKEN);
    this.expiresAt = new Date();
  }

  isTokenExpired(): boolean {
    return this.jwtHelperService.isTokenExpired(this.getToken());
  }

  isTokenPresent(): boolean {
    return this.getToken() !== null && this.getToken().length > 0;
  }

}
