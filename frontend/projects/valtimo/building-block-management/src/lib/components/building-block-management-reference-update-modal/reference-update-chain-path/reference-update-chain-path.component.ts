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

import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {BuildingBlockReferenceUpdateChainDto} from '@valtimo/shared';
import {BuildingBlockReferenceUpdateWizardService} from '../building-block-reference-update-wizard.service';
import {BuildingBlockReferenceUpdateStatusTagComponent} from '../reference-update-status-tag/reference-update-status-tag.component';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-reference-update-chain-path',
  templateUrl: './reference-update-chain-path.component.html',
  styleUrls: ['../styles/reference-update-step.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, BuildingBlockReferenceUpdateStatusTagComponent],
})
export class BuildingBlockReferenceUpdateChainPathComponent {
  @Input({required: true}) public chain!: BuildingBlockReferenceUpdateChainDto;

  public readonly $target = this.wizardService.$target;
  public readonly $targetKey = this.wizardService.$targetKey;

  constructor(private readonly wizardService: BuildingBlockReferenceUpdateWizardService) {}
}
