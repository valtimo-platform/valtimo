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
import {HttpClient, HttpResponse} from '@angular/common/http';
import {Observable} from 'rxjs';
import {Context, ContextProcess, UserContextActiveProcess} from '@valtimo/contract';
import {ConfigService} from '@valtimo/config';

@Injectable({
  providedIn: 'root'
})
export class ContextService {
  private valtimoApiConfig: any;

  constructor(
    private http: HttpClient,
    configService: ConfigService
  ) {
    this.valtimoApiConfig = configService.config.valtimoApi;
  }

  public query(params?: any): Observable<HttpResponse<Context[]>> {
    return this.http.get<Context[]>(`${this.valtimoApiConfig.endpointUri}contexts`, {observe: 'response', params: params});
  }

  public get(contextId: number): Observable<Context> {
    return this.http.get<Context>(`${this.valtimoApiConfig.endpointUri}contexts/${contextId}`);
  }

  public create(context: Context) {
    return this.http.post(`${this.valtimoApiConfig.endpointUri}contexts`, context);
  }

  public update(context: Context) {
    return this.http.put(`${this.valtimoApiConfig.endpointUri}contexts`, context);
  }

  public delete(contextId: number) {
    return this.http.delete(`${this.valtimoApiConfig.endpointUri}contexts/${contextId}`);
  }

  public getUserContexts(): Observable<Context[]> {
    return this.http.get<Context[]>(`${this.valtimoApiConfig.endpointUri}user/contexts`);
  }

  public getUserContextActive(): Observable<Context> {
    return this.http.get<Context>(`${this.valtimoApiConfig.endpointUri}user/context`);
  }

  public getUserContextProceses(): Observable<ContextProcess[]> {
    return this.http.get<ContextProcess[]>(`${this.valtimoApiConfig.endpointUri}user/context/processes`);
  }

  public getUserContextProcessesActive(): Observable<UserContextActiveProcess[]> {
    return this.http.get<UserContextActiveProcess[]>(`${this.valtimoApiConfig.endpointUri}context/process/user/active`);
  }

  public setUserContext(contextId: number) {
    return this.http.post(`${this.valtimoApiConfig.endpointUri}user/context`, {contextId: contextId});
  }

}
