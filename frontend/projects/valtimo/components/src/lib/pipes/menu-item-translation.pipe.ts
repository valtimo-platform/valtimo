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
import {MenuItem} from '@valtimo/config';
import {combineLatest, map, Observable} from 'rxjs';
import {TranslateService} from '@ngx-translate/core';

@Pipe({name: 'menuItemTranslate'})
export class MenuItemTranslationPipe implements PipeTransform {
  constructor(private readonly translateService: TranslateService) {}

  transform(menuItem: MenuItem): Observable<string> {
    const pageTranslationKey = 'pages.' + menuItem.title.toLowerCase() + '.title';
    const titleTranslationKey = menuItem.title;

    return combineLatest([
      this.translateService.stream(pageTranslationKey),
      this.translateService.stream(titleTranslationKey),
    ]).pipe(
      map(([pageTranslation, menuItemTitleTranslation]) => {
        if (pageTranslation !== pageTranslationKey) {
          return pageTranslation;
        } else if (menuItemTitleTranslation !== titleTranslationKey) {
          return menuItemTitleTranslation;
        }

        return menuItem.title;
      })
    );
  }
}
