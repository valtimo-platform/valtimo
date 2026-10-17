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
import {CheckboxModule, LoadingModule, TagModule} from 'carbon-components-angular';
import {BUILDING_BLOCK_MANAGEMENT_REFERENCE_UPDATE_TEST_IDS} from '../../../constants';
import {BuildingBlockReferenceUpdateWizardService} from '../building-block-reference-update-wizard.service';
import {BuildingBlockReferenceUpdateChainPathComponent} from '../reference-update-chain-path/reference-update-chain-path.component';
import {BuildingBlockReferenceUpdatePreviewStatusComponent} from '../reference-update-preview-status/reference-update-preview-status.component';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-reference-update-chains-step',
  templateUrl: './reference-update-chains-step.component.html',
  styleUrls: ['../styles/reference-update-step.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
    CheckboxModule,
    LoadingModule,
    TagModule,
    BuildingBlockReferenceUpdateChainPathComponent,
    BuildingBlockReferenceUpdatePreviewStatusComponent,
  ],
})
export class BuildingBlockReferenceUpdateChainsStepComponent {
  protected readonly testIds = BUILDING_BLOCK_MANAGEMENT_REFERENCE_UPDATE_TEST_IDS;

  public readonly $preview = this.wizardService.$preview;
  public readonly $previewFailed = this.wizardService.$previewFailed;
  public readonly $selectedChainIds = this.wizardService.$selectedChainIds;
  public readonly $source = this.wizardService.$source;
  public readonly $target = this.wizardService.$target;
  public readonly $targetKey = this.wizardService.$targetKey;

  constructor(private readonly wizardService: BuildingBlockReferenceUpdateWizardService) {}

  public onChainCheckedChange(chainId: string, checked: boolean): void {
    this.wizardService.setChainSelected(chainId, checked);
  }
}
