/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import {MenuItem} from '@valtimo/shared';
import {Observable, of} from 'rxjs';
import {map} from 'rxjs/operators';
import {IkoApiService} from './iko-api.service';

@Injectable({providedIn: 'root'})
export class IkoMenuService {
  private readonly _IKO_MENU_ITEM_TITLE_TRANSLATION_KEY = 'iko.pageTitle';

  constructor(private readonly ikoApiService: IkoApiService) {}

  public appendIkoMenuItems = (menuItems: MenuItem[]): Observable<MenuItem[]> => {
    const ikoExists = menuItems.some(
      item => item.title === this._IKO_MENU_ITEM_TITLE_TRANSLATION_KEY
    );
    if (ikoExists) return of(menuItems);

    return this.ikoApiService.getIkoViews().pipe(
      map(ikoItems => {
        this.ikoApiService.setCachedMenuItems(ikoItems.content);

        let updatedMenuItems = [...menuItems];

        if (ikoItems.content?.length) {
          const ikoSubMenu: MenuItem[] = ikoItems.content.map((item, index) => ({
            link: ['/iko', item.key],
            title: item.title,
            sequence: index,
            show: true,
          }));

          const ikoMenu: MenuItem = {
            title: this._IKO_MENU_ITEM_TITLE_TRANSLATION_KEY,
            iconClass: 'icon mdi mdi-account',
            show: true,
            children: ikoSubMenu,
          };

          updatedMenuItems = this.insertAfterCases(updatedMenuItems, ikoMenu);
        }

        const adminMenuItem = updatedMenuItems.find(
          item =>
            item.title.toUpperCase().includes('ADMIN') && !item.title.toUpperCase().includes('IKO')
        );

        if (adminMenuItem && !adminMenuItem.children?.some(item => item.title === 'IKO')) {
          adminMenuItem.children = this.insertAfterCases(adminMenuItem.children ?? [], {
            title: 'IKO',
            show: true,
            link: ['/iko-management'],
          });
        }

        return updatedMenuItems;
      })
    );
  };

  private insertAfterCases(menuItems: MenuItem[], newItem: MenuItem): MenuItem[] {
    const casesIndex = menuItems.findIndex(
      item => item.title === 'Cases' || item.title === 'Dossiers'
    );
    if (casesIndex === -1) {
      const lastSequence = menuItems[menuItems.length - 1]?.sequence;
      return [
        ...menuItems,
        {...newItem, sequence: lastSequence !== undefined ? lastSequence + 1 : undefined},
      ];
    }
    const itemWithSequence: MenuItem = {
      ...newItem,
      sequence: this.sequenceBetween(menuItems[casesIndex], menuItems[casesIndex + 1]),
    };
    return [
      ...menuItems.slice(0, casesIndex + 1),
      itemWithSequence,
      ...menuItems.slice(casesIndex + 1),
    ];
  }

  private sequenceBetween(prev: MenuItem, next?: MenuItem): number | undefined {
    if (prev.sequence === undefined) return undefined;
    if (next?.sequence !== undefined && next.sequence > prev.sequence) {
      return (prev.sequence + next.sequence) / 2;
    }
    return prev.sequence;
  }
}
