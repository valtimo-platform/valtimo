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

import {Pipe, PipeTransform} from '@angular/core';
import {map, Observable, of} from 'rxjs';
import {TranslateService} from '@ngx-translate/core';
import {TabImpl} from '../../models';

@Pipe({
  name: 'tabTranslate',
})
export class TabTranslatePipe implements PipeTransform {
  constructor(private readonly translateService: TranslateService) {}

  transform(tab: TabImpl): Observable<string> {
    const translationId = 'dossier.tabs.' + tab.name;

    return tab.title
      ? of(tab.title)
      : this.translateService
          .stream(translationId)
          .pipe(map(translation => (translationId !== translation ? translation : tab.name)));
  }
}
