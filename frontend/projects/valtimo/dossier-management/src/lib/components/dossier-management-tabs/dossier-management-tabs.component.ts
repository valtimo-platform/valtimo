/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
import {Component, Input} from '@angular/core';
import {
  CarbonTableConfig,
  ColumnConfig,
  createCarbonTableConfig,
  ViewType,
} from '@valtimo/components';
import {Observable} from 'rxjs';
import {ApiTabItem} from '@valtimo/dossier';
import {TabManagementService} from '../../services';

@Component({
  selector: 'valtimo-dossier-management-tabs',
  templateUrl: './dossier-management-tabs.component.html',
})
export class DossierManagementTabsComponent {
  @Input() set documentDefinitionName(value: string) {
    if (!value) {
      return;
    }

    this.tabManagementService.loadTabs(value);
  }

  public readonly loading$: Observable<boolean> = this.tabManagementService.loading$;
  public readonly tabs$: Observable<ApiTabItem[]> = this.tabManagementService.tabs$;

  public readonly fields: ColumnConfig[] = [
    {
      key: 'name',
      label: 'dossierManagement.tabManagement.columns.name',
      viewType: ViewType.TEXT,
    },
    {
      key: 'key',
      label: 'dossierManagement.tabManagement.columns.key',
      viewType: ViewType.TEXT,
    },
    {
      key: 'type',
      label: 'dossierManagement.tabManagement.columns.type',
      viewType: ViewType.TEXT,
    },
    {
      key: 'contentKey',
      label: 'dossierManagement.tabManagement.columns.content',
      viewType: ViewType.TEXT,
    },
  ];

  public readonly tableConfig: CarbonTableConfig = createCarbonTableConfig({sortable: false});

  constructor(private readonly tabManagementService: TabManagementService) {}
}
