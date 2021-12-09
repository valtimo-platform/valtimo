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
import {HttpClient} from '@angular/common/http';
import {Authority} from '@valtimo/contract';
import {Observable} from 'rxjs';
import {ConfigService} from '@valtimo/config';

@Injectable({
  providedIn: 'root'
})
export class AuthorityService {
  private valtimoApiConfig: any;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.valtimoApiConfig = configService.config.valtimoApi;
  }

  query(params?: any): Observable<any> {
    return this.http.get<Authority>(`${this.valtimoApiConfig.endpointUri}authorities`, {observe: 'response', params: params});
  }

  get(name: string): Observable<any> {
    return this.http.get<Authority>(`${this.valtimoApiConfig.endpointUri}authorities/${name}`);
  }

  create(authority: any): Observable<any> {
    return this.http.post(`${this.valtimoApiConfig.endpointUri}authorities`, authority);
  }

  delete(name: any) {
    return this.http.delete(`${this.valtimoApiConfig.endpointUri}authorities/${name}`);
  }

  update(authority: any): Observable<any> {
    return this.http.put(`${this.valtimoApiConfig.endpointUri}authorities`, authority);
  }
}
