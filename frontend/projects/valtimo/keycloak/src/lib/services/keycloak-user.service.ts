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

import {Injectable, OnDestroy} from '@angular/core';
import {combineLatest, map, ReplaySubject, Subject, Subscription, switchMap, timer} from 'rxjs';
import {NGXLogger} from 'ngx-logger';
import {KeycloakEventType, KeycloakService} from 'keycloak-angular';
import {ConfigService, UserIdentity, UserService, ValtimoUserIdentity} from '@valtimo/config';
import {KeycloakOptionsService} from './keycloak-options.service';
import {jwtDecode} from 'jwt-decode';
import {TranslateService} from '@ngx-translate/core';
import {DatePipe} from '@angular/common';
import {take} from 'rxjs/operators';
import {Router} from '@angular/router';
import {STORAGE_KEYS} from '../constants';
import {KeycloakStorageService} from './keycloak-storage.service';
import {PromptService} from '@valtimo/components';

@Injectable({
  providedIn: 'root',
})
export class KeycloakUserService implements UserService, OnDestroy {
  private userIdentity: ReplaySubject<UserIdentity>;

  private tokenRefreshSubscription!: Subscription;
  private refreshTokenSubscription!: Subscription;
  private expiryTimerSubscription!: Subscription;

  private readonly _refreshToken$ = new Subject<string>();

  private _tokenExp!: number;

  private readonly FIVE_MINUTES_MS = 300000;
  private readonly EXPIRE_TOKEN_CONFIRMATION = 'EXPIRE_TOKEN_CONFIRMATION';

  private _counter!: Date;

  constructor(
    private readonly keycloakService: KeycloakService,
    private readonly keycloakOptionsService: KeycloakOptionsService,
    private readonly logger: NGXLogger,
    private readonly promptService: PromptService,
    private readonly translateService: TranslateService,
    private readonly datePipe: DatePipe,
    private readonly configService: ConfigService,
    private readonly router: Router,
    private readonly keycloakStorageService: KeycloakStorageService
  ) {
    this.openTokenRefreshSubscription();
    this.openRefreshTokenSubscription();
  }

  ngOnDestroy(): void {
    this.tokenRefreshSubscription?.unsubscribe();
    this.refreshTokenSubscription?.unsubscribe();
    this.closeExpiryTimerSubscription();
  }

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
        user.username,
        user.id
      );
      this.logger.debug('KeycloakUserService: loaded user identity', valtimoUserIdentity);
      this.userIdentity.next(valtimoUserIdentity);
    });
    this.setRefreshToken();
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

  private openTokenRefreshSubscription(): void {
    this.tokenRefreshSubscription = this.keycloakService.keycloakEvents$.subscribe(
      keycloakEvent => {
        if (keycloakEvent.type === KeycloakEventType.OnAuthRefreshSuccess) {
          this.setRefreshToken();
        }
      }
    );
  }

  private get _expiryTimeMs() {
    return this._tokenExp - Date.now() - 1000;
  }

  private openRefreshTokenSubscription(): void {
    this.refreshTokenSubscription = this._refreshToken$.subscribe(refreshToken => {
      const decodedRefreshToken = jwtDecode(refreshToken);
      this._tokenExp = decodedRefreshToken.exp * 1000;

      this.closeExpiryTimerSubscription();
      this.openExpiryTimerSubscription();
    });
  }

  private setRefreshToken(): void {
    const refreshToken = this.keycloakService.getKeycloakInstance()?.refreshToken;
    if (refreshToken) this._refreshToken$.next(refreshToken);
  }

  private openExpiryTimerSubscription(): void {
    this.expiryTimerSubscription = timer(0, 1000)
      .pipe(
        switchMap(() => {
          if (this._expiryTimeMs <= this.FIVE_MINUTES_MS) {
            this._counter = new Date(0, 0, 0, 0, 0, 0);
            this._counter.setSeconds(this._expiryTimeMs / 1000);
          }

          return combineLatest([
            this.promptService.promptVisible$,
            this.translateService.stream('keycloak.expiryPromptTitle'),
            this.translateService.stream('keycloak.expiryPromptDescription', {
              expiryTime: this.datePipe.transform(this._counter, 'mm:ss'),
            }),
            this.translateService.stream('keycloak.expiryPromptCancel'),
            this.translateService.stream('keycloak.expiryPromptConfirm'),
          ]);
        })
      )
      .subscribe(([promptVisible, headerText, bodyText, cancelButtonText, confirmButtonText]) => {
        this.promptService.identifier$.pipe(take(1)).subscribe(identifier => {
          if (
            (!promptVisible || identifier !== this.EXPIRE_TOKEN_CONFIRMATION) &&
            this._expiryTimeMs <= this.FIVE_MINUTES_MS
          ) {
            this.openConfirmationPrompt(headerText, bodyText, cancelButtonText, confirmButtonText);
          }

          if (promptVisible && identifier === this.EXPIRE_TOKEN_CONFIRMATION) {
            this.promptService.setBodyText(bodyText);
          }
        });

        if (this._expiryTimeMs < 2000) {
          this.saveUrl();
          this.logout();
        }
      });
  }

  private closeExpiryTimerSubscription(): void {
    this.expiryTimerSubscription?.unsubscribe();
  }

  private openConfirmationPrompt(
    headerText: string,
    bodyText: string,
    cancelButtonText: string,
    confirmButtonText: string
  ): void {
    this.promptService.openPrompt({
      identifier: this.EXPIRE_TOKEN_CONFIRMATION,
      headerText,
      bodyText,
      cancelButtonText,
      confirmButtonText,
      cancelMdiIcon: 'logout',
      confirmMdiIcon: 'check',
      closeOnConfirm: true,
      closeOnCancel: false,
      cancelCallbackFunction: () => {
        this.keycloakService.logout();
      },
      confirmCallBackFunction: () => {
        this.closeExpiryTimerSubscription();
        this.updateToken(20);
      },
    });
  }

  private saveUrl(): void {
    const returnToLastUrlAfterTokenExpiration =
      this.configService?.config?.featureToggles?.returnToLastUrlAfterTokenExpiration;

    if (returnToLastUrlAfterTokenExpiration) {
      sessionStorage.setItem(
        STORAGE_KEYS.urlBeforeExpiration,
        this.keycloakStorageService.getCurrentUrl()
      );
      sessionStorage.setItem(
        STORAGE_KEYS.urlBeforeExpirationParams,
        this.keycloakStorageService.getCurrentUrlParams()
      );
    }
  }
}
