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
import {Observable} from 'rxjs';
import {ChoicefieldValue} from '@valtimo/contract';
import {ConfigService} from '@valtimo/config';

@Injectable({providedIn: 'root'})
export class ChoicefieldService {
  private valtimoEndpointUri: string;

  constructor(
    private http: HttpClient,
    configService: ConfigService
  ) {
    this.valtimoEndpointUri = configService.config.valtimoApi.endpointUri;
  }

  getChoiceFields(): Observable<any> {
    return this.http.get(this.valtimoEndpointUri + 'choice-fields');
  }

  getChoiceFieldByName(name: string): Observable<any> {
    return this.http.get(this.valtimoEndpointUri + 'choice-fields/name/' + name);
  }

  getChoiceFieldValuesByName(name: string): Observable<ChoicefieldValue[]> {
    return this.http.get<ChoicefieldValue[]>(this.valtimoEndpointUri + 'choice-field-values/' + name + '/values');
  }

  getChoiceFieldValueByNameAndValue(name: string, value: string): Observable<any> {
    return this.http.get(this.valtimoEndpointUri + 'choice-field-values/choice-field/' + name + '/value/' + value);
  }

  getChoiceFieldValueById(id: number): Observable<any> {
    return this.http.get(this.valtimoEndpointUri + 'choice-field-values/' + id);
  }

}
