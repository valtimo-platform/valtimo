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
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  Input,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {CarbonTableConfig, ColumnConfig, ViewType} from '@valtimo/components';
import {ApiTabItem} from '@valtimo/dossier';
import {BehaviorSubject, Observable} from 'rxjs';
import {TabManagementService} from '../../services';

@Component({
  selector: 'valtimo-dossier-management-tabs',
  templateUrl: './dossier-management-tabs.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DossierManagementTabsComponent implements AfterViewInit {
  @ViewChild('tabTypeColumn') tabTypeColumnTemplate: TemplateRef<any>;

  @Input() set documentDefinitionName(value: string) {
    if (!value) {
      return;
    }

    this.tabManagementService.loadTabs(value);
  }

  public readonly fields$ = new BehaviorSubject<ColumnConfig[]>([]);
  public readonly loading$: Observable<boolean> = this.tabManagementService.loading$;
  public readonly tabs$: Observable<ApiTabItem[]> = this.tabManagementService.tabs$;
  public readonly tableConfig: CarbonTableConfig = {sortable: false};

  constructor(
    private readonly tabManagementService: TabManagementService,
    private readonly translateService: TranslateService
  ) {}

  public ngAfterViewInit(): void {
    this.fields$.next([
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
        viewType: ViewType.TEMPLATE,
        template: this.tabTypeColumnTemplate,
        key: '',
        label: 'dossierManagement.tabManagement.columns.type',
      },
      {
        key: 'contentKey',
        label: 'dossierManagement.tabManagement.columns.content',
        viewType: ViewType.TEXT,
      },
    ]);
  }

  public isTranslated(key: string): boolean {
    return this.translateService.instant(key) !== key;
  }
}
