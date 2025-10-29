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
import {Component, OnDestroy, OnInit, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  BuildingBlockManagementApiService,
  BuildingBlockManagementDetailService,
} from '../../services';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  map,
  Observable,
  Subscription,
  switchMap,
  tap,
} from 'rxjs';
import {isEqual} from 'lodash';
import {CarbonListModule, ColumnConfig, ViewType} from '@valtimo/components';
import {BuildingBlockProcessDefinitionDto} from '@valtimo/shared';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {BuildingBlockProcessDefinitionItem} from '../../models';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {Upload16} from '@carbon/icons';
import {BUILDING_BLOCK_MANAGEMENT_TABS} from '../../constants';
import {Router} from '@angular/router';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-processes',
  templateUrl: './building-block-management-processes.component.html',
  styleUrls: ['./building-block-management-processes.component.scss'],
  imports: [CommonModule, CarbonListModule, TranslateModule, ButtonModule, IconModule],
})
export class BuildingBlockManagementProcessesComponent implements OnInit, OnDestroy {
  public readonly $loading = signal<boolean>(true);

  private readonly _buildingBlockProcessDefinitions$ = new BehaviorSubject<
    BuildingBlockProcessDefinitionDto[]
  >([]);

  public readonly buildingBlockProcessDefinitionItems$: Observable<
    BuildingBlockProcessDefinitionItem[]
  > = combineLatest([
    this._buildingBlockProcessDefinitions$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([processDefinitions]) =>
      processDefinitions.map(definition => ({
        ...definition,
        mainText: this.translateService.instant(
          'buildingBlockManagement.processDefinition.mainText'
        ),
      }))
    )
  );

  public readonly FIELDS: ColumnConfig[] = [
    {key: 'name', label: 'buildingBlockManagement.processDefinition.name'},
    {key: 'key', label: 'buildingBlockManagement.processDefinition.key'},
    {
      key: 'mainText',
      label: '',
      viewType: ViewType.TAGS,
    },
  ];

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly buildingBlockManagementDetailService: BuildingBlockManagementDetailService,
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService,
    private readonly translateService: TranslateService,
    private readonly iconService: IconService,
    private readonly router: Router
  ) {
    this.iconService.registerAll([Upload16]);
  }

  public ngOnInit(): void {
    this._subscriptions.add(
      combineLatest([
        this.buildingBlockManagementDetailService.buildingBlockDefinitionKey$,
        this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag$,
      ])
        .pipe(
          distinctUntilChanged((a, b) => isEqual(a, b)),
          tap(() => this.$loading.set(true)),
          switchMap(([key, versionTag]) =>
            this.buildingBlockManagementApiService.getBuildingBlockProcessDefinitions(
              key,
              versionTag
            )
          ),
          tap(processDefinitions => {
            this._buildingBlockProcessDefinitions$.next(processDefinitions);
            this.$loading.set(false);
          })
        )
        .subscribe()
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onRowClick(processDefinition: BuildingBlockProcessDefinitionItem): void {
    this.router.navigate([
      '/building-block-management',
      'building-block',
      this.buildingBlockManagementDetailService.buildingBlockDefinitionKey,
      'version',
      this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag,
      BUILDING_BLOCK_MANAGEMENT_TABS.PROCESSES,
      processDefinition.id,
    ]);
  }

  public showUploadModal(): void {}

  public showCreateModal(): void {}
}
