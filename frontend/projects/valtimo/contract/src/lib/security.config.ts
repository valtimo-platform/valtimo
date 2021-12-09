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

import {Observable, ReplaySubject} from 'rxjs';
import {EmailNotificationSettings} from './email-notification-settings.model';
import {Injector} from '@angular/core';

export interface UserIdentity {
  email: string;
  firstName: string;
  lastName: string;
  roles: Array<string>;
  username?: string;
}

export class ValtimoUserIdentity implements UserIdentity {
  private readonly _email: string;
  private readonly _firstName: string;
  private readonly _lastName: string;
  private readonly _roles: string[];
  private readonly _username?: string;

  constructor(email: string, firstName: string, lastName: string, roles: Array<string>, username?: string) {
    this._email = email;
    this._firstName = firstName;
    this._lastName = lastName;
    this._roles = roles;
    this._username = username;
  }

  get email(): string {
    return this._email;
  }

  get firstName(): string {
    return this._firstName;
  }

  get lastName(): string {
    return this._lastName;
  }

  get roles(): string[] {
    return this._roles;
  }

  get username(): string {
    return this._username;
  }
}

export interface UserService {
  getUserSubject(): ReplaySubject<UserIdentity>;

  logout(): void;

  getToken(): Promise<string>;

  updateToken?(minValidity: number): Promise<boolean>;
}

export interface EmailNotificationService {
  getEmailNotificationSettings(): Observable<EmailNotificationSettings>;

  updateEmailNotificationSettings(settings: EmailNotificationSettings): Observable<EmailNotificationSettings>;
}

export interface AuthProviders {
  guardServiceProvider: any;
  userServiceProvider: any;
}

export interface Auth {
  module: any;
  initializer: (injector: Injector) => Function;
  authProviders: AuthProviders;
  options: any;
}
