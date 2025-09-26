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
import {TranslateService} from '@ngx-translate/core';
import {DataSourceSpecification, DisplayTypeSpecification} from '../models';
import {combineLatest, Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {WidgetService} from './widget.service';

@Injectable({
  providedIn: 'root',
})
export class WidgetTranslationService {
  constructor(
    private readonly translateService: TranslateService,
    private readonly widgetService: WidgetService
  ) {}

  translate(translateKey: string, key: string): Observable<string> {
    return combineLatest([
      this.widgetService.supportedDisplayTypes$,
      this.widgetService.supportedDataSources$,
      this.translateService.stream('key'),
    ]).pipe(
      map(([supportedDisplayTypes, supportedDataSources]) =>
        this.getTranslation(supportedDisplayTypes, supportedDataSources, key, translateKey)
      )
    );
  }

  instant(translateKey: string, displayTypeKey: string): string {
    return this.getTranslation(
      this.widgetService.supportedDisplayTypes,
      this.widgetService.supportedDataSources,
      displayTypeKey,
      translateKey
    );
  }

  private getTranslation(
    supportedDisplayTypes: Array<DisplayTypeSpecification>,
    supportedDataSources: Array<DataSourceSpecification>,
    key: string,
    translateKey: string
  ): string {
    const currentLang = this.translateService.currentLang;
    const displayTypeSpecification = supportedDisplayTypes.find(
      displayType => displayType.displayTypeKey === key
    );
    const dataSourceSpecification = supportedDataSources.find(
      datasource => datasource.dataSourceKey === key
    );

    let translation = '';

    if (
      displayTypeSpecification &&
      displayTypeSpecification.translations.hasOwnProperty(currentLang)
    ) {
      translation = displayTypeSpecification.translations[currentLang][translateKey];
    } else if (
      dataSourceSpecification &&
      dataSourceSpecification.translations.hasOwnProperty(currentLang)
    ) {
      translation = dataSourceSpecification.translations[currentLang][translateKey];
    }

    return translation || `${key}.${translateKey}`;
  }
}
