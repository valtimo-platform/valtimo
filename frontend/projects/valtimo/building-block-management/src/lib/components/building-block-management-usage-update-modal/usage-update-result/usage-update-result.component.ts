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

import {ChangeDetectionStrategy, Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterLink} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {BuildingBlockUsageUpdateDraftDto} from '@valtimo/shared';
import {NotificationModule} from 'carbon-components-angular';
import {
  BUILDING_BLOCK_MANAGEMENT_TABS,
  BUILDING_BLOCK_MANAGEMENT_USAGE_UPDATE_TEST_IDS,
} from '../../../constants';
import {BuildingBlockUsageUpdateWizardService} from '../building-block-usage-update-wizard.service';
import {BuildingBlockUsageUpdateChainListComponent} from '../usage-update-chain-list/usage-update-chain-list.component';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-usage-update-result',
  templateUrl: './usage-update-result.component.html',
  styleUrls: ['../styles/usage-update-step.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    TranslateModule,
    NotificationModule,
    BuildingBlockUsageUpdateChainListComponent,
  ],
})
export class BuildingBlockUsageUpdateResultComponent {
  protected readonly testIds = BUILDING_BLOCK_MANAGEMENT_USAGE_UPDATE_TEST_IDS;

  public readonly $result = this.wizardService.$result;

  constructor(private readonly wizardService: BuildingBlockUsageUpdateWizardService) {}

  public onDraftLinkClick(): void {
    this.wizardService.close();
  }

  public draftRoute(draft: BuildingBlockUsageUpdateDraftDto): string[] {
    return draft.type === 'CASE'
      ? ['/case-management', 'case', draft.key, 'version', draft.versionTag, 'general']
      : [
          '/building-block-management',
          'building-block',
          draft.key,
          'version',
          draft.versionTag,
          BUILDING_BLOCK_MANAGEMENT_TABS.GENERAL,
        ];
  }
}
