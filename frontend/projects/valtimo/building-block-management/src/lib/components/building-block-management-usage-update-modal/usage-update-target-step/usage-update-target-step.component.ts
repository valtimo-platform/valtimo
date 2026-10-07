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
  BUILDING_BLOCK_MANAGEMENT_USAGE_UPDATE_TEST_IDS,
  BUILDING_BLOCK_USAGE_UPDATE_TARGET_KEY_OPTION_TEST_ID_PREFIX,
  BUILDING_BLOCK_USAGE_UPDATE_TARGET_OPTION_TEST_ID_PREFIX,
} from '../../../constants';
import {UsageUpdateVersionListItem} from '../../../models';
import {BuildingBlockUsageUpdateWizardService} from '../building-block-usage-update-wizard.service';
import {BuildingBlockUsageUpdateStatusTagComponent} from '../usage-update-status-tag/usage-update-status-tag.component';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-usage-update-target-step',
  templateUrl: './usage-update-target-step.component.html',
  styleUrls: ['../styles/usage-update-step.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
    ComboBoxModule,
    DropdownModule,
    LoadingModule,
    NotificationModule,
    BuildingBlockUsageUpdateStatusTagComponent,
  ],
})
export class BuildingBlockUsageUpdateTargetStepComponent {
  protected readonly testIds = BUILDING_BLOCK_MANAGEMENT_USAGE_UPDATE_TEST_IDS;

  public readonly $source = this.wizardService.$source;
  public readonly $targetDefinitions = this.wizardService.$targetDefinitions;
  public readonly $targetKey = this.wizardService.$targetKey;
  public readonly $targetVersions = this.wizardService.$targetVersions;

  public readonly $targetKeyItems = computed((): ListItem[] => {
    const targetKey = this.$targetKey();
    return (this.$targetDefinitions() ?? [])
      .map(definition => ({
        id: definition.key,
        content: definition.name ? `${definition.name} (${definition.key})` : definition.key,
        selected: definition.key === targetKey,
        'data-test-id': `${BUILDING_BLOCK_USAGE_UPDATE_TARGET_KEY_OPTION_TEST_ID_PREFIX}${definition.key}`,
      }))
      .sort((left, right) => left.content.localeCompare(right.content));
  });

  public readonly $targetItems = computed((): UsageUpdateVersionListItem[] => {
    const target = this.wizardService.$target();
    return (this.$targetVersions() ?? [])
      .filter(version => !this.wizardService.isSourceVersion(this.$targetKey(), version.versionTag))
      .map(version => ({
        id: version.versionTag,
        content: version.versionTag,
        selected: version.versionTag === target,
        final: version.final,
        'data-test-id': `${BUILDING_BLOCK_USAGE_UPDATE_TARGET_OPTION_TEST_ID_PREFIX}${version.versionTag}`,
      }));
  });

  constructor(private readonly wizardService: BuildingBlockUsageUpdateWizardService) {}

  public onTargetKeySelected(event: ListItem | ListItem[] | null): void {
    this.wizardService.selectTargetKey(event);
  }

  public onTargetSelected(event: ListItem | ListItem[] | null): void {
    this.wizardService.selectTarget(event);
  }
}
