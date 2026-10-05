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
import {combineLatest, map, Observable, switchMap} from 'rxjs';
import {DropdownModule, ListItem, TagModule} from 'carbon-components-angular';
import {
  BUILDING_BLOCK_MANAGEMENT_DETAIL_ACTIONS_TEST_IDS,
  BUILDING_BLOCK_VERSION_OPTION_TEST_ID_PREFIX,
} from '../../constants';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-version-selector',
  templateUrl: './building-block-management-version-selector.component.html',
  styleUrls: ['./building-block-management-version-selector.component.scss'],
  imports: [CommonModule, DropdownModule, TagModule],
})
export class BuildingBlockManagementVersionSelectorComponent {
  protected readonly testIds = BUILDING_BLOCK_MANAGEMENT_DETAIL_ACTIONS_TEST_IDS;

  private readonly _versions$ = combineLatest([
    this.buildingBlockManagementDetailService.buildingBlockDefinitionKey$,
    this.buildingBlockManagementDetailService.reloadVersions$,
  ]).pipe(
    switchMap(([key]) =>
      this.buildingBlockManagementApiService.getVersionsForBuildingBlock(key, 0, 10, true)
    )
  );

  public readonly versionListItems$: Observable<ListItem[]> = combineLatest([
    this._versions$,
    this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag$,
  ]).pipe(
    map(([versions, versionTag]) =>
      versions.content.map(version => ({
        id: version.versionTag,
        content: version.versionTag,
        selected: versionTag === version.versionTag,
        final: version.final,
        'data-test-id': `${BUILDING_BLOCK_VERSION_OPTION_TEST_ID_PREFIX}${version.versionTag}`,
      }))
    )
  );

  public onVersionSelected(event: {item?: {id?: string}}): void {
    const versionTag = event?.item?.id;
    if (!versionTag) return;
    this.buildingBlockManagementDetailService.navigateToVersionTag(versionTag);
  }

  constructor(
    private readonly buildingBlockManagementDetailService: BuildingBlockManagementDetailService,
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService
  ) {}
}
