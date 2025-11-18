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
import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  BuildingBlockManagementApiService,
  BuildingBlockManagementDetailService,
} from '../../services';
import {BehaviorSubject, combineLatest, map, Observable, tap} from 'rxjs';
import {PluginManagementService} from '@valtimo/plugin';
import {LoadingModule, TagModule} from 'carbon-components-angular';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-plugins',
  templateUrl: './building-block-management-plugins.component.html',
  styleUrls: ['./building-block-management-plugins.component.scss'],
  imports: [CommonModule, LoadingModule, TranslatePipe, TagModule],
})
export class BuildingBlockManagementPluginsComponent {
  public readonly loading$ = new BehaviorSubject<boolean>(true);

  public readonly usedPluginTitles$: Observable<string[]> = combineLatest([
    this.pluginManagementService.getPluginDefinitions(),
    this.buildingBlockManagementApiService.getPluginDefinitionsForBuildingBlock(
      this.buildingBlockManagementDetailService.buildingBlockDefinitionKey,
      this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag
    ),
  ]).pipe(
    map(([pluginDefinitions, pluginDefinitionsForBuildingBlock]) =>
      pluginDefinitionsForBuildingBlock.map(
        pluginDefinitionForBuildingBlock =>
          pluginDefinitions.find(
            pluginDefinition => pluginDefinition.key === pluginDefinitionForBuildingBlock
          )?.title ?? pluginDefinitionForBuildingBlock
      )
    ),
    tap(() => this.loading$.next(false))
  );

  constructor(
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService,
    private readonly pluginManagementService: PluginManagementService,
    private readonly buildingBlockManagementDetailService: BuildingBlockManagementDetailService
  ) {}
}
