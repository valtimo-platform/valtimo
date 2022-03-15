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
import {IncludeFunction, ValtimoConfig, Page, ConnectorInstance, ConnectorType} from '../models';
import {HttpClient} from '@angular/common/http';
import {ConfigService} from './config.service';
import {Observable, of} from 'rxjs';
import {map, switchMap} from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class MenuIncludeService {
  private valtimoConfig!: ValtimoConfig;

  constructor(private readonly http: HttpClient, private readonly configService: ConfigService) {
    this.valtimoConfig = configService.config;
  }

  getIncludeFunction(includeFunction: IncludeFunction): Observable<boolean> {
    switch (includeFunction) {
      case IncludeFunction.HaalcentraalConnectorConfigured:
        return this.isHaalcentraalConnectorConfigured();
      default:
        return of(true);
    }
  }

  private isHaalcentraalConnectorConfigured(): Observable<boolean> {
    return this.getConnectorTypes().pipe(
      map(types => {
        const haalcentraalType = types.find(type => type.name === 'HaalCentraal');
        const haalCentraalTypeId = haalcentraalType?.id;

        return haalCentraalTypeId;
      }),
      switchMap(haalcentraalTypeId => {
        if (haalcentraalTypeId) {
          return this.getConnectorInstancesByType(haalcentraalTypeId);
        } else {
          return of(undefined);
        }
      }),
      map(haalcentraalConnectorInstances => {
        return haalcentraalConnectorInstances?.content?.length > 0;
      })
    );
  }

  private getConnectorTypes(): Observable<Array<ConnectorType>> {
    return this.http.get<Array<ConnectorType>>(
      `${this.valtimoConfig.valtimoApi.endpointUri}connector/type`
    );
  }

  private getConnectorInstancesByType(
    typeId: string,
    params?: any
  ): Observable<Page<ConnectorInstance>> {
    return this.http.get<Page<ConnectorInstance>>(
      `${this.valtimoConfig.valtimoApi.endpointUri}connector/instance/${typeId}`,
      {params}
    );
  }
}
