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
import {ChoiceField} from '@valtimo/contract';
import {ConfigService} from '@valtimo/config';

@Injectable({
  providedIn: 'root'
})
export class ChoiceFieldService {

  private valtimoApiConfig: any;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.valtimoApiConfig = configService.config.valtimoApi;
  }

  query(params?: any): Observable<any> {
    return this.http.get<ChoiceField>(`${this.valtimoApiConfig.endpointUri}choice-fields`
      , {observe: 'response', params: params});
  }

  get(id: string): Observable<any> {
    return this.http.get<ChoiceField>(`${this.valtimoApiConfig.endpointUri}choice-fields/${id}`);
  }

  create(choiceField: any): Observable<any> {
    return this.http.post(`${this.valtimoApiConfig.endpointUri}choice-fields`, choiceField);
  }

  delete(id: any) {
    return this.http.delete(`${this.valtimoApiConfig.endpointUri}choice-fields/${id}`);
  }

  update(choiceField: any): Observable<any> {
    return this.http.put(`${this.valtimoApiConfig.endpointUri}choice-fields`, choiceField);
  }

  queryValues(keyName: string, params?: any): Observable<any> {
    return this.http.get<ChoiceField>(`${this.valtimoApiConfig.endpointUri}choice-field-values/${keyName}/values`
      , {observe: 'response', params: params});
  }

  getValue(choiceFieldId: string): Observable<any> {
    return this.http.get<ChoiceField>(`${this.valtimoApiConfig.endpointUri}choice-field-values/${choiceFieldId}`);
  }

  updateValue(choiceFieldValue: any, choiceFieldName: string): Observable<any> {
    return this.http.put(`${this.valtimoApiConfig.endpointUri}choice-field-values`,
      choiceFieldValue,
      {
        params: {choice_field_name: choiceFieldName}
      });
  }

  createValue(choiceFieldValue: any, choiceFieldName: string): Observable<any> {
    return this.http.post(`${this.valtimoApiConfig.endpointUri}choice-field-values`,
      choiceFieldValue,
      {params: {choice_field_name: choiceFieldName}});
  }

}
