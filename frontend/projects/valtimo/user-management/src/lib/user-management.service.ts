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
import {Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {User} from '@valtimo/contract';
import {ConfigService} from '@valtimo/config';

@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  private valtimoApiConfig: any;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.valtimoApiConfig = configService.config.valtimoApi;
  }

  query(params?: any): Observable<any> {
    return this.http.get<User>(`${this.valtimoApiConfig.endpointUri}users`, {params: params});
  }

  get(id: string): Observable<any> {
    return this.http.get(`${this.valtimoApiConfig.endpointUri}users/${id}`);
  }

  create(user: any): Observable<any> {
    return this.http.post(`${this.valtimoApiConfig.endpointUri}users`, user);
  }

  delete(id: any) {
    return this.http.delete(`${this.valtimoApiConfig.endpointUri}users/${id}`);
  }

  update(user: any): Observable<any> {
    return this.http.put(`${this.valtimoApiConfig.endpointUri}users`, user);
  }

  resendVerificationEmail(id: string) {
    return this.http.post(`${this.valtimoApiConfig.endpointUri}users/send-verification-email/${id}`, {});
  }

  activate(id: string) {
    return this.http.put(`${this.valtimoApiConfig.endpointUri}users/${id}/activate`, {});
  }

  deactivate(id: string) {
    return this.http.put(`${this.valtimoApiConfig.endpointUri}users/${id}/deactivate`, {});
  }

  getAuthorities(params?: any): Observable<any> {
    return this.http.get<any>(`${this.valtimoApiConfig.endpointUri}authorities`, {observe: 'response', params: params});
  }
}
