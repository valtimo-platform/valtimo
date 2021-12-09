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
import {Observable, ReplaySubject} from 'rxjs';
import {NGXLogger} from 'ngx-logger';
import {EmailNotificationService, EmailNotificationSettings, UserIdentity, UserService} from '@valtimo/contract';
import {HttpClient} from '@angular/common/http';
import {ConfigService} from '@valtimo/config';

@Injectable({
  providedIn: 'root'
})
export class UserProviderService implements UserService, EmailNotificationService {
  private readonly userService: UserService;
  private valtimoApiConfig: {
    endpointUri: string;
  };

  constructor(
    private configService: ConfigService,
    private injector: Injector,
    private http: HttpClient,
    private logger: NGXLogger
  ) {
    this.valtimoApiConfig = configService.config.valtimoApi;
    this.userService = injector.get<any>(configService.config.authentication.authProviders.userServiceProvider);
    this.logger.debug('Loading UserProviderService service', this.userService);
  }

  getUserSubject(): ReplaySubject<UserIdentity> {
    this.logger.debug('Delegating UserProviderService::getUserIdentity');
    return this.userService.getUserSubject();
  }

  logout(): void {
    this.logger.debug('Delegating UserProviderService::logout');
    return this.userService.logout();
  }

  async getToken(): Promise<string> {
    this.logger.debug('Delegating UserProviderService::getToken');
    return this.userService.getToken();
  }

  async updateToken(minValidity: number): Promise<boolean> {
    this.logger.debug('Delegating UserProviderService::updateToken');
    if (this.userService.updateToken) {
      return this.userService.updateToken(minValidity);
    } else {
      return new Promise(resolve => resolve(true));
    }
  }

  public getEmailNotificationSettings(): Observable<EmailNotificationSettings> {
    this.logger.debug('getEmailNotificationSettings');
    return this.http.get<EmailNotificationSettings>(`${this.valtimoApiConfig.endpointUri}email-notification-settings`);
  }

  public updateEmailNotificationSettings(settings: EmailNotificationSettings): Observable<EmailNotificationSettings> {
    this.logger.debug('updateEmailNotificationSettings', settings);
    return this.http.put<EmailNotificationSettings>(
      `${this.valtimoApiConfig.endpointUri}email-notification-settings`,
      settings
    );
  }
}
