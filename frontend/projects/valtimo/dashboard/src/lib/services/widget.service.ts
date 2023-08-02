/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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

import {Inject, Injectable} from '@angular/core';
import {DISPLAY_TYPE_TOKEN} from '../constants';
import {DisplayTypeSpecification, WidgetData} from '../models';
import {BehaviorSubject, filter, Observable} from 'rxjs';
import {ConfigService} from '@valtimo/config';
import {HttpClient} from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class WidgetService {
  private _endpointUri: string;

  private readonly _supportedDisplayTypes$ =
    new BehaviorSubject<Array<DisplayTypeSpecification> | null>(null);

  public get supportedDisplayTypes$(): Observable<Array<DisplayTypeSpecification>> {
    return this._supportedDisplayTypes$.pipe(filter(specifications => !!specifications));
  }

  constructor(
    @Inject(DISPLAY_TYPE_TOKEN)
    private readonly supportedDisplayTypes: Array<DisplayTypeSpecification | null>,
    private readonly configService: ConfigService,
    private readonly http: HttpClient
  ) {
    this._endpointUri = `${this.configService.config.valtimoApi.endpointUri}v1/dashboard`;
    this.setSupportedDisplayTypes(this.supportedDisplayTypes);
  }

  public getWidgetData(dashboardKey: string): Observable<WidgetData[]> {
    return this.http.get<WidgetData[]>(`${this._endpointUri}/${dashboardKey}/data`);
  }

  private setSupportedDisplayTypes(
    supportedDisplayTypes: Array<DisplayTypeSpecification | null>
  ): void {
    this._supportedDisplayTypes$.next(supportedDisplayTypes.filter(displayType => !!displayType));
  }
}
