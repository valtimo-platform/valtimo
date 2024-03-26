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
import {PluginService} from './plugin.service';
import {PluginSpecification} from '../models';
import {combineLatest, Observable} from 'rxjs';
import {map} from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class PluginTranslationService {
  constructor(
    private readonly translateService: TranslateService,
    private readonly pluginService: PluginService
  ) {}

  translate(translateKey: string, pluginDefinitionKey: string): Observable<string> {
    return combineLatest([
      this.pluginService.pluginSpecifications$,
      this.translateService.stream('key'),
    ]).pipe(
      map(([pluginSpecifications]) =>
        this.getTranslation(pluginSpecifications, pluginDefinitionKey, translateKey)
      )
    );
  }

  instant(translateKey: string, pluginDefinitionKey: string): string {
    return this.getTranslation(
      this.pluginService.pluginSpecifications,
      pluginDefinitionKey,
      translateKey
    );
  }

  private getTranslation(
    pluginSpecifications: Array<PluginSpecification>,
    pluginDefinitionKey: string,
    translateKey: string
  ): string {
    const currentLang = this.translateService.currentLang;
    const pluginSpecification = pluginSpecifications.find(
      specification => specification.pluginId === pluginDefinitionKey
    );
    const translation = pluginSpecification?.pluginTranslations[currentLang][translateKey];
    return translation || `${pluginDefinitionKey}.${translateKey}`;
  }
}
