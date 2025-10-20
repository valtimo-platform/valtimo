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
import {CarbonListModule, ColumnConfig} from '@valtimo/components';
import {BuildingBlockManagementApiService, BuildingBlockManagementService} from '../../services';
import {switchMap, tap} from 'rxjs';
import {ButtonModule, IconModule} from 'carbon-components-angular';
import {TranslatePipe} from '@ngx-translate/core';
import {BuildingBlockManagementCreateModalComponent} from '../building-block-management-create-modal/building-block-management-create-modal.component';

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
    {key: 'title', label: 'buildingBlockManagement.listColumns.title'},
    {key: 'key', label: 'buildingBlockManagement.listColumns.key'},
    {key: 'versionTag', label: 'buildingBlockManagement.listColumns.versionTag'},
  ];

  constructor(
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService,
    private readonly buildingBlockManagementService: BuildingBlockManagementService
  ) {}

  public showCreateModal(): void {
    this.buildingBlockManagementService.showCreateModal();
  }
}
