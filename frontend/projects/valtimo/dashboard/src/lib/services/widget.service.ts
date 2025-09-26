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

import {Inject, Injectable} from '@angular/core';
import {DATA_SOURCE_TOKEN, DISPLAY_TYPE_TOKEN} from '../constants';
import {DataSourceSpecification, DisplayTypeSpecification} from '../models';
import {BehaviorSubject, filter, Observable} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class WidgetService {
  private readonly _supportedDisplayTypes$ =
    new BehaviorSubject<Array<DisplayTypeSpecification> | null>(null);

  private readonly _supportedDataSources$ =
    new BehaviorSubject<Array<DataSourceSpecification> | null>(null);

  public get supportedDisplayTypes$(): Observable<Array<DisplayTypeSpecification>> {
    return this._supportedDisplayTypes$.pipe(filter(specifications => !!specifications));
  }

  public get supportedDataSources$(): Observable<Array<DataSourceSpecification>> {
    return this._supportedDataSources$.pipe(filter(specifications => !!specifications));
  }

  public get supportedDisplayTypes(): Array<DisplayTypeSpecification> {
    return this._supportedDisplayTypes$.getValue() || [];
  }

  public get supportedDataSources(): Array<DataSourceSpecification> {
    return this._supportedDataSources$.getValue() || [];
  }

  constructor(
    @Inject(DISPLAY_TYPE_TOKEN)
    private readonly supportedDisplayTypesFromToken: Array<DisplayTypeSpecification | null>,
    @Inject(DATA_SOURCE_TOKEN)
    private readonly supportedDataSourcesFromToken: Array<DataSourceSpecification | null>
  ) {
    this.setSupportedDisplayTypes(supportedDisplayTypesFromToken);
    this.setSupportedDataSources(supportedDataSourcesFromToken);
  }

  private setSupportedDisplayTypes(
    supportedDisplayTypes: Array<DisplayTypeSpecification | null>
  ): void {
    this._supportedDisplayTypes$.next(supportedDisplayTypes.filter(displayType => !!displayType));
  }

  private setSupportedDataSources(
    supportedDataSources: Array<DataSourceSpecification | null>
  ): void {
    this._supportedDataSources$.next(supportedDataSources.filter(dataSource => !!dataSource));
  }
}
