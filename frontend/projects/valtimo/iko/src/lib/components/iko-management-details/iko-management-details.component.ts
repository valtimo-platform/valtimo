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
import {CommonModule} from '@angular/common';
import {Component} from '@angular/core';
import {CarbonListModule, ColumnConfig, PageTitleService} from '@valtimo/components';
import {IkoApiService} from '../../services';
import {BehaviorSubject, combineLatest, filter} from 'rxjs';
import {ActivatedRoute} from '@angular/router';
import {map} from 'rxjs/operators';
import {TabsModule} from 'carbon-components-angular';
import {IkoManagementTab, IkoManagementTabType} from '../../models';
import {IkoManagementSearchFieldsComponent} from './components/search-fields/iko-management-search-fields.component';
import {IkoManagementListComponent} from './components/list/iko-management-list.component';
import {IkoManagementTabsComponent} from './components/tabs/iko-management-tabs.component';
import {TranslateModule} from '@ngx-translate/core';

@Component({
  selector: 'valtimo-iko-management-details',
  standalone: true,
  templateUrl: './iko-management-details.component.html',
  imports: [CommonModule, CarbonListModule, TabsModule, TranslateModule],
  styleUrl: './iko-management-details.component.scss',
})
export class IkoManagementDetailsComponent {
  public readonly loading$ = new BehaviorSubject<boolean>(true);

  private readonly _key$ = this.route.params.pipe(
    map(params => params?.key),
    filter(key => !!key)
  );

  public readonly currentMenuItem$ = combineLatest([
    this._key$,
    this.ikoApiService.cachedMenuItems$,
  ]).pipe(
    map(([key, items]) => {
      const currentItem = items.find(item => item.key === key);
      if (!currentItem) return;
      this.pageTitleService.setCustomPageTitle(currentItem.title);
    })
  );

  public readonly FIELDS: ColumnConfig[] = [
    {
      key: 'title',
      label: 'ikoManagement.title',
    },
  ];

  public readonly TABS: IkoManagementTab[] = [
    {
      key: IkoManagementTabType.SEARCH_FIELDS,
      title: 'ikoManagement.searchFields',
      component: IkoManagementSearchFieldsComponent,
    },
    {
      key: IkoManagementTabType.LIST,
      title: 'ikoManagement.list',
      component: IkoManagementListComponent,
    },
    {
      key: IkoManagementTabType.TABS,
      title: 'ikoManagement.tabs',
      component: IkoManagementTabsComponent,
    },
  ];

  public readonly activeIkoManagementTabType$ = new BehaviorSubject<IkoManagementTabType>(
    IkoManagementTabType.SEARCH_FIELDS
  );

  constructor(
    private readonly ikoApiService: IkoApiService,
    private readonly route: ActivatedRoute,
    private readonly pageTitleService: PageTitleService
  ) {}

  public onTabSelected(tab: IkoManagementTab): void {
    this.activeIkoManagementTabType$.next(tab.key);
  }
}
