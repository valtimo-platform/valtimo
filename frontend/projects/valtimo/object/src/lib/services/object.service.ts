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

import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {ConfigService} from '@valtimo/config';
import {ObjectConfiguration} from '../models/object.model';
import {FormDefinition} from '@valtimo/form-management';

@Injectable({
  providedIn: 'root',
})
export class ObjectService {
  private readonly valtimoEndpointUri: string;

  constructor(
    private http: HttpClient,
    configService: ConfigService
  ) {
    this.valtimoEndpointUri = configService.config.valtimoApi.endpointUri;
  }

  public getObjectsByObjectManagementId(
    objectManagementId: string,
    params?: any
  ): Observable<ObjectConfiguration> {
    return this.http.get<ObjectConfiguration>(
      `${this.valtimoEndpointUri}v1/object/management/configuration/${objectManagementId}/object`,
      {params}
    );
  }

  public postObjectsByObjectManagementId(
    objectManagementId: string,
    params?: any,
    payload?: any
  ): Observable<ObjectConfiguration> {
    return this.http.post<ObjectConfiguration>(
      `${this.valtimoEndpointUri}v1/object/management/configuration/${objectManagementId}/object`,
      payload,
      {params}
    );
  }

  public createObject(params: {objectManagementId: string}, payload: object): Observable<any> {
    return this.http.post<any>(`${this.valtimoEndpointUri}v1/object`, payload, {params});
  }

  public updateObject(
    params: {objectManagementId: string; objectId: string},
    payload: object
  ): Observable<any> {
    return this.http.patch<any>(`${this.valtimoEndpointUri}v1/object`, payload, {params});
  }

  public deleteObject(params: {objectManagementId: string; objectId: string}): Observable<any> {
    return this.http.delete<any>(`${this.valtimoEndpointUri}v1/object`, {params});
  }

  public getPrefilledObjectFromObjectUrl(params: any): Observable<FormDefinition> {
    return this.http.get<FormDefinition>(`${this.valtimoEndpointUri}v1/object/form`, {params});
  }

  public removeEmptyStringValuesFromSubmission(submission) {
    return Object.fromEntries(Object.entries(submission).filter(([_, value]) => value !== ''));
  }
}
