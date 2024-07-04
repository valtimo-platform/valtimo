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
import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {ConfigService, Page} from '@valtimo/config';
import {Observable} from 'rxjs';
import {ChoiceField, ChoiceFieldValue, ChoicefieldValue} from '../models';

@Injectable({
  providedIn: 'root',
})
export class ChoiceFieldService {
  private valtimoApiConfig: any;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.valtimoApiConfig = this.configService.config.valtimoApi;
  }

  query(params?: any): Observable<any> {
    return this.http.get<ChoiceField>(`${this.valtimoApiConfig.endpointUri}v1/choice-fields`, {
      observe: 'response',
      params,
    });
  }

  queryPage(params?: any): Observable<Page<ChoiceField>> {
    return this.http.get<Page<ChoiceField>>(
      `${this.valtimoApiConfig.endpointUri}v2/choice-fields`,
      {
        params,
      }
    );
  }

  get(id: string): Observable<any> {
    return this.http.get<ChoiceField>(`${this.valtimoApiConfig.endpointUri}v1/choice-fields/${id}`);
  }

  create(choiceField: any): Observable<any> {
    return this.http.post(`${this.valtimoApiConfig.endpointUri}v1/choice-fields`, choiceField);
  }

  delete(id: any) {
    return this.http.delete(`${this.valtimoApiConfig.endpointUri}v1/choice-fields/${id}`);
  }

  update(choiceField: any): Observable<any> {
    return this.http.put(`${this.valtimoApiConfig.endpointUri}v1/choice-fields`, choiceField);
  }

  queryValues(keyName: string, params?: any): Observable<any> {
    return this.http.get<ChoiceField>(
      `${this.valtimoApiConfig.endpointUri}v1/choice-field-values/${keyName}/values`,
      {observe: 'response', params}
    );
  }

  queryValuesPage(keyName: string, params?: any): Observable<Page<ChoiceFieldValue>> {
    return this.http.get<Page<ChoiceFieldValue>>(
      `${this.valtimoApiConfig.endpointUri}v2/choice-field-values/${keyName}/values`,
      {params}
    );
  }

  getValue(choiceFieldId: string): Observable<any> {
    return this.http.get<ChoiceField>(
      `${this.valtimoApiConfig.endpointUri}v1/choice-field-values/${choiceFieldId}`
    );
  }

  updateValue(choiceFieldValue: any, choiceFieldName: string): Observable<any> {
    return this.http.put(
      `${this.valtimoApiConfig.endpointUri}v1/choice-field-values`,
      choiceFieldValue,
      {
        params: {choice_field_name: choiceFieldName},
      }
    );
  }

  createValue(choiceFieldValue: any, choiceFieldName: string): Observable<any> {
    return this.http.post(
      `${this.valtimoApiConfig.endpointUri}v1/choice-field-values`,
      choiceFieldValue,
      {params: {choice_field_name: choiceFieldName}}
    );
  }

  getChoiceFieldByName(name: string): Observable<any> {
    return this.http.get(this.valtimoApiConfig.endpointUri + 'v1/choice-fields/name/' + name);
  }

  getChoiceFieldValueByNameAndValue(name: string, value: string): Observable<any> {
    return this.http.get(
      this.valtimoApiConfig.endpointUri +
        'v1/choice-field-values/choice-field/' +
        name +
        '/value/' +
        value
    );
  }
}
