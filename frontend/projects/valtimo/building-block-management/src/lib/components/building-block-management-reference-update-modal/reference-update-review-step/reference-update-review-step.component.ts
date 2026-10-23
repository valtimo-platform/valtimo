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
import {TranslateModule} from '@ngx-translate/core';
import {CheckboxModule, LoadingModule, TagModule} from 'carbon-components-angular';
import {BUILDING_BLOCK_MANAGEMENT_REFERENCE_UPDATE_TEST_IDS} from '../../../constants';
import {BuildingBlockReferenceUpdateWizardService} from '../building-block-reference-update-wizard.service';
import {BuildingBlockReferenceUpdateChainListComponent} from '../reference-update-chain-list/reference-update-chain-list.component';
import {BuildingBlockReferenceUpdatePreviewStatusComponent} from '../reference-update-preview-status/reference-update-preview-status.component';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-reference-update-review-step',
  templateUrl: './reference-update-review-step.component.html',
  styleUrls: ['../styles/reference-update-step.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    CheckboxModule,
    LoadingModule,
    TagModule,
    BuildingBlockReferenceUpdateChainListComponent,
    BuildingBlockReferenceUpdatePreviewStatusComponent,
  ],
})
export class BuildingBlockReferenceUpdateReviewStepComponent {
  protected readonly testIds = BUILDING_BLOCK_MANAGEMENT_REFERENCE_UPDATE_TEST_IDS;

  public readonly $confirmed = this.wizardService.$confirmed;
  public readonly $executing = this.wizardService.$executing;
  public readonly $preview = this.wizardService.$preview;

  constructor(private readonly wizardService: BuildingBlockReferenceUpdateWizardService) {}

  public onConfirmedChange(confirmed: boolean): void {
    this.wizardService.setConfirmed(confirmed);
  }
}
