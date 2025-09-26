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

import {HttpBackend, HttpClient} from '@angular/common/http';
import {catchError, map, switchMap} from 'rxjs/operators';
import {combineLatest, forkJoin, Observable, of} from 'rxjs';
import {deepmerge} from 'deepmerge-ts';
import {ITranslationResource} from '../models';
import {TranslateLoader} from '@ngx-translate/core';
import {LocalizationService} from '../services/localization.service';

export class CustomMultiTranslateHttpLoader implements TranslateLoader {
  private readonly _handler: HttpBackend;
  private readonly _httpClient: HttpClient;
  private readonly _resourcesPrefix: Array<string> | ITranslationResource[];
  private readonly _localizationService: LocalizationService;
  constructor(
    _handler: HttpBackend,
    _httpClient: HttpClient,
    _localizationService: LocalizationService,
    _resourcesPrefix: Array<string> | ITranslationResource[]
  ) {
    this._handler = _handler;
    this._httpClient = _httpClient;
    this._resourcesPrefix = _resourcesPrefix;
    this._localizationService = _localizationService;
  }
  getTranslation(lang: string): Observable<any> {
    const requests = this._resourcesPrefix.map(resource => {
      let path;
      if (resource.prefix) path = `${resource.prefix}${lang}${resource.suffix || '.json'}`;
      else path = `${resource}${lang}.json`;
      return new HttpClient(this._handler).get(path).pipe(
        catchError(res => {
          if (!resource.optional) {
            console.group();
            console.error('Something went wrong for the following translation file:', path);
            console.error(res);
            console.groupEnd();
          }
          return of({});
        })
      );
    });

    return forkJoin(requests).pipe(
      switchMap(localResourcesResponse =>
        combineLatest([of(localResourcesResponse), this._localizationService.getLocalization(lang)])
      ),
      map(([localResourcesResponse, localizationResponse]) =>
        deepmerge(...[...localResourcesResponse, localizationResponse])
      )
    );
  }
}
