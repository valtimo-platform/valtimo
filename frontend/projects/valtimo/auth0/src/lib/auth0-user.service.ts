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
import {interval, Observable, ReplaySubject} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {NGXLogger} from 'ngx-logger';
import {UserIdentity, UserService, ValtimoUserIdentity} from '@valtimo/contract';
import {ConfigService} from '@valtimo/config';
import {JwtAuthService} from './jwt-auth.service';
import {now} from 'moment';
import {Router} from '@angular/router';
import {switchMap} from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class Auth0UserService implements UserService {

  public someId: string = now().toLocaleString();
  public sessionExpired = false;
  public userIdentity: ReplaySubject<UserIdentity>;
  private auth0js: any;
  private POLLING_INTERVAL = 9000000; // 15 minutes

  static resetUserIdentity(): void {
    localStorage.removeItem('userIdentity');
  }

  private static getRedirectTo(): string {
    return sessionStorage.getItem('redirectTo');
  }

  public static storeRedirectTo(route: string): void {
    sessionStorage.setItem('redirectTo', route);
  }

  private static clearRedirectTo(): void {
    sessionStorage.removeItem('redirectTo');
  }

  constructor(
    private http: HttpClient,
    private configService: ConfigService,
    private jwtAuthService: JwtAuthService,
    public router: Router,
    private logger: NGXLogger
  ) {
    const localUserIdentity = localStorage.getItem('userIdentity');
    this.userIdentity = new ReplaySubject<UserIdentity>();
    if (localUserIdentity !== null) {
      this.userIdentity.next(JSON.parse(localUserIdentity));
    }
    this.logger.debug('Auth0UserService: ctor userIdentity', localUserIdentity);
    this.checkSessionPeriodically();
  }

  getUserSubject(): ReplaySubject<UserIdentity> {
    return this.userIdentity;
  }

  logout(): void {
    this.logger.debug('logging out');
    this.jwtAuthService.removeToken();
    Auth0UserService.resetUserIdentity();
    const logoutUrl = window.location.origin;

    this.auth0js.logout({
      client_id: this.configService.config.authentication.options.clientId,
      returnTo: logoutUrl
    });
  }

  getToken(): Promise<string> {
    return new Promise<string>(resolve => resolve(this.jwtAuthService.getToken()));
  }

  public setAuth0JsInstance(auth0js: any) {
    this.logger.debug('setAuth0JsInstance', auth0js);
    this.auth0js = auth0js;
  }

  public async login() {
    this.logger.debug('login');
    await this.handleAuthentication();
  }

  private checkSessionPeriodically() {
    interval(this.POLLING_INTERVAL)
      .pipe(
        switchMap(() => this.checkSessionAlive())
      ).subscribe((sessionAlive: boolean) => {
        this.sessionExpired = !sessionAlive;
        this.logger.info(`session alive is ${sessionAlive}`);
      }
    );
  }

  private async checkSessionAlive() {
    this.logger.info('checking session');
    if (this.jwtAuthService.isTokenExpired()) {
      await this.refreshToken({doLogout: false}).catch(e => {
        this.logger.error('session is dead', e);
        return false;
      });
    }
    this.logger.info('session is alive');
    return true;
  }

  public async handleAuthentication() {
    this.logger.debug('handleAuthentication');
    return new Promise((resolve) => {
      this.auth0js.parseHash((error: any, authResult: any) => {
        this.logger.debug('Checking session: ', authResult, error);
        if (error) {
          // Login again
          this.logger.error(error);
          this.auth0js.authorize();
          resolve();
        } else if (authResult && authResult.idToken) {
          this.logger.debug('Login successful');
          this.localLogin(authResult);
          resolve();
        } else {
          this.logger.info('No auth try to login');
          this.auth0js.authorize(); // Login
          resolve();
        }
      });
    });
  }

  public refreshToken(options: { doLogout: boolean } = {doLogout: true}): Promise<any> {
    return new Promise((resolve, reject) => {
      this.auth0js.checkSession({}, (err: any, authResult: any) => {
        if (authResult && authResult.idToken && authResult.idTokenPayload) {
          this.localLogin(authResult);
          resolve();
        } else if (err) {
          this.logger.error(err);
          if (options.doLogout) {
            this.logout();
          }
          reject(err);
        }
      });
    });
  }

  private localLogin(authResult: any): void {
    this.logger.debug('LocalLogin');
    this.jwtAuthService.storeToken(authResult.idToken);
    const valtimoUserIdentity = new ValtimoUserIdentity(
      authResult.idTokenPayload.email,
      authResult.idTokenPayload.user_metadata.firstname,
      authResult.idTokenPayload.user_metadata.lastname,
      authResult.idTokenPayload.roles
    );
    this.setUserIdentity(valtimoUserIdentity);
  }

  setUserIdentity(userIdentity: UserIdentity): void {
    this.logger.debug('Auth0UserService: setUserIdentity', userIdentity);
    this.userIdentity.next(userIdentity);
    localStorage.setItem('userIdentity', JSON.stringify(userIdentity));
  }

  public determineRedirect(): string {
    const redirectTo = Auth0UserService.getRedirectTo();
    let redirect = '/';
    if (redirectTo !== null) {
      redirect = redirectTo;
    }
    Auth0UserService.clearRedirectTo();
    return redirect;
  }

  updateProfile(profile: any): Observable<any> {
    return this.http.post(`${this.configService.config.valtimoApi.endpointUri}account/profile`, profile);
  }

  changePassword(password: string): Observable<any> {
    return this.http.post(`${this.configService.config.valtimoApi.endpointUri}account/change_password`, password);
  }

}
