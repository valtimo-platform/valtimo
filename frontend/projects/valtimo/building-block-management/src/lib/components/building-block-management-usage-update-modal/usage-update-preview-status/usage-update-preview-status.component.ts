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
import {TranslateModule} from '@ngx-translate/core';
import {ButtonModule, NotificationModule} from 'carbon-components-angular';
import {BUILDING_BLOCK_MANAGEMENT_USAGE_UPDATE_TEST_IDS} from '../../../constants';
import {BuildingBlockUsageUpdateWizardService} from '../building-block-usage-update-wizard.service';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-usage-update-preview-status',
  templateUrl: './usage-update-preview-status.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, ButtonModule, NotificationModule],
})
export class BuildingBlockUsageUpdatePreviewStatusComponent {
  protected readonly testIds = BUILDING_BLOCK_MANAGEMENT_USAGE_UPDATE_TEST_IDS;

  public readonly $preview = this.wizardService.$preview;
  public readonly $previewFailed = this.wizardService.$previewFailed;

  constructor(private readonly wizardService: BuildingBlockUsageUpdateWizardService) {}

  public onRetryPreview(): void {
    this.wizardService.requestPreview();
  }
}
