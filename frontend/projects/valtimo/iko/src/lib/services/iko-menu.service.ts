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
  constructor(private readonly ikoApiService: IkoApiService) {}

  public appendIkoMenuItems = (menuItems: MenuItem[]): Observable<MenuItem[]> => {
    const ikoExists = menuItems.some(item => item.title === 'IKO');
    if (ikoExists) return of(menuItems);

    return this.ikoApiService.getIkoDataAggregates().pipe(
      map(ikoItems => {
        this.ikoApiService.setCachedMenuItems(ikoItems.content);

        const ikoSubMenu: MenuItem[] = ikoItems.content.map((item, index) => ({
          link: ['/iko', item.key],
          title: item.title,
          sequence: index,
          show: true,
        }));

        const ikoMenu: MenuItem = {
          title: 'IKO',
          iconClass: 'icon mdi mdi-account',
          show: true,
          sequence: this.getIkoSequenceAfterCases(menuItems),
          children: ikoSubMenu,
        };

        const adminMenuItem = menuItems.find(item => item.title.toUpperCase().includes('ADMIN'));

        if (adminMenuItem) {
          adminMenuItem.children = [
            ...adminMenuItem.children,
            {
              title: ikoMenu.title,
              show: true,
              sequence: adminMenuItem.children[adminMenuItem.children.length - 1].sequence + 1,
              link: ['/iko-management'],
            },
          ];
        }

        return [...menuItems, ikoMenu].sort((a, b) => a.sequence - b.sequence);
      })
    );
  };

  private getIkoSequenceAfterCases(menuItems: MenuItem[]): number {
    const casesItem = menuItems.find(item => item.title === 'Cases' || item.title === 'Dossiers');
    const casesSequence = Number(casesItem?.sequence ?? 0);
    return casesSequence + 0.5;
  }
}
