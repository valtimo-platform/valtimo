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
import {Component, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CarbonListModule, ColumnConfig, ViewType} from '@valtimo/components';
import {BuildingBlockManagementApiService, BuildingBlockManagementService} from '../../services';
import {switchMap, tap} from 'rxjs';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {TranslatePipe} from '@ngx-translate/core';
import {
  BuildingBlockManagementCreateModalComponent,
} from '../building-block-management-create-modal/building-block-management-create-modal.component';
import {BuildingBlockDefinitionDto} from '@valtimo/shared';
import {Upload16} from '@carbon/icons';
import {Router} from '@angular/router';
import {BUILDING_BLOCK_MANAGEMENT_TABS} from '../../constants';
import {
  BuildingBlockManagementUploadModalComponent,
} from '../building-block-management-upload-modal/building-block-management-upload-modal.component';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-list',
  templateUrl: './building-block-management-list.component.html',
  styleUrls: ['./building-block-management-list.component.scss'],
  imports: [
    CommonModule,
    CarbonListModule,
    ButtonModule,
    IconModule,
    TranslatePipe,
    BuildingBlockManagementCreateModalComponent,
    BuildingBlockManagementUploadModalComponent,
  ],
  providers: [BuildingBlockManagementService],
})
export class BuildingBlockManagementListComponent {
  public readonly $loading = signal<boolean>(true);

  public readonly buildingBlockDefinitions$ = this.buildingBlockManagementService.reload$.pipe(
    switchMap(() => this.buildingBlockManagementApiService.getBuildingBlockDefinitions()),
    tap(res => {
      this.buildingBlockManagementService.setUsedKeys(res.map(item => item.key));
      this.$loading.set(false);
    })
  );

  public readonly FIELDS: ColumnConfig[] = [
    {key: 'name', label: 'buildingBlockManagement.listColumns.name'},
    {key: 'key', label: 'buildingBlockManagement.listColumns.key'},
    {
      key: 'versionTag',
      label: 'buildingBlockManagement.listColumns.versionTag',
      viewType: ViewType.TAGS,
    },
  ];

  constructor(
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService,
    private readonly buildingBlockManagementService: BuildingBlockManagementService,
    private readonly iconService: IconService,
    private readonly router: Router
  ) {
    this.iconService.registerAll([Upload16]);
  }

  public showCreateModal(): void {
    this.buildingBlockManagementService.showCreateModal();
  }

  public showUploadModal(): void {
    this.buildingBlockManagementService.showUploadModal();
  }

  public onRowClick(buildingBlockDefinition: BuildingBlockDefinitionDto): void {
    this.router.navigate([
      '/building-block-management',
      'building-block',
      buildingBlockDefinition.key,
      'version',
      buildingBlockDefinition.versionTag,
      BUILDING_BLOCK_MANAGEMENT_TABS.GENERAL,
    ]);
  }
}
