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
import {ConfigService} from '@valtimo/config';
import {HttpClient} from '@angular/common/http';
import {WidgetData} from '../models';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class WidgetApiService {
  private _endpointUri: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly http: HttpClient
  ) {
    this._endpointUri = `${this.configService.config.valtimoApi.endpointUri}v1/dashboard`;
  }

  public getWidgetData(dashboardKey: string): Observable<WidgetData[]> {
    return this.http.get<WidgetData[]>(`${this._endpointUri}/${dashboardKey}/data`);
  }
}
