/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
import {DocumentService} from '@valtimo/document';
import {MenuItem} from '@valtimo/shared';
import {MenuService} from '@valtimo/components';
import {from, Observable, of} from 'rxjs';
import {switchMap} from 'rxjs/operators';

@Injectable({providedIn: 'root'})
export class GroupMenuService {
  constructor(
    private readonly documentService: DocumentService,
    private readonly menuService: MenuService
  ) {
    this.menuService.registerAppendMenuItemsFunction(this._appendGroupMenuItems.bind(this));
  }

  private _appendGroupMenuItems = (menuItems: MenuItem[]): Observable<MenuItem[]> => {
    return from(this.documentService.getCaseDefinitionGroups()).pipe(
      switchMap(groups => {
        if (groups.length === 0) {
          return of(menuItems);
        }

        const groupItems: MenuItem[] = groups.map((group, index) => ({
          link: ['/groups/' + group.key],
          title: group.title,
          iconClass: 'icon mdi mdi-folder-multiple',
          sequence: index,
          show: true,
        }));

        const casesIndex = menuItems.findIndex(
          i => i.title === 'Cases' || i.title === 'Dossiers'
        );

        if (casesIndex >= 0) {
          menuItems.splice(casesIndex + 1, 0, ...groupItems);
        }

        return of(menuItems);
      })
    );
  };
}
