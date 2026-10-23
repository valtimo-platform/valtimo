/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

import {ChangeDetectionStrategy, Component, computed} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {
  ComboBoxModule,
  DropdownModule,
  ListItem,
  LoadingModule,
  NotificationModule,
} from 'carbon-components-angular';
import {
  BUILDING_BLOCK_MANAGEMENT_REFERENCE_UPDATE_TEST_IDS,
  BUILDING_BLOCK_REFERENCE_UPDATE_SOURCE_KEY_OPTION_TEST_ID_PREFIX,
  BUILDING_BLOCK_REFERENCE_UPDATE_SOURCE_OPTION_TEST_ID_PREFIX,
} from '../../../constants';
import {ReferenceUpdateVersionListItem} from '../../../models';
import {BuildingBlockReferenceUpdateWizardService} from '../building-block-reference-update-wizard.service';
import {BuildingBlockReferenceUpdateStatusTagComponent} from '../reference-update-status-tag/reference-update-status-tag.component';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-reference-update-source-step',
  templateUrl: './reference-update-source-step.component.html',
  styleUrls: ['../styles/reference-update-step.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
    ComboBoxModule,
    DropdownModule,
    LoadingModule,
    NotificationModule,
    BuildingBlockReferenceUpdateStatusTagComponent,
  ],
})
export class BuildingBlockReferenceUpdateSourceStepComponent {
  protected readonly testIds = BUILDING_BLOCK_MANAGEMENT_REFERENCE_UPDATE_TEST_IDS;

  public readonly $inUseVersions = this.wizardService.$inUseVersions;
  public readonly $sourceKey = this.wizardService.$sourceKey;

  public readonly $sourceKeyItems = computed((): ListItem[] => {
    const sourceKey = this.$sourceKey();
    const versionsByKey = new Map(
      (this.$inUseVersions() ?? []).map(version => [version.key, version])
    );
    return [...versionsByKey.values()]
      .map(version => ({
        id: version.key,
        content: version.name ? `${version.name} (${version.key})` : version.key,
        selected: version.key === sourceKey,
        'data-test-id': `${BUILDING_BLOCK_REFERENCE_UPDATE_SOURCE_KEY_OPTION_TEST_ID_PREFIX}${version.key}`,
      }))
      .sort((left, right) => left.content.localeCompare(right.content));
  });

  public readonly $sourceItems = computed((): ReferenceUpdateVersionListItem[] => {
    const source = this.wizardService.$source();
    return this.wizardService.versionsForKey(this.$sourceKey()).map(version => ({
      id: this.wizardService.sourceItemId(version),
      content: version.versionTag,
      selected:
        !!source &&
        this.wizardService.sourceItemId(source) === this.wizardService.sourceItemId(version),
      final: version.final,
      'data-test-id': `${BUILDING_BLOCK_REFERENCE_UPDATE_SOURCE_OPTION_TEST_ID_PREFIX}${version.key}-${version.versionTag}`,
    }));
  });

  constructor(private readonly wizardService: BuildingBlockReferenceUpdateWizardService) {}

  public onSourceKeySelected(event: ListItem | ListItem[] | null): void {
    this.wizardService.selectSourceKey(event);
  }

  public onSourceSelected(event: ListItem | ListItem[] | null): void {
    this.wizardService.selectSource(event);
  }
}
