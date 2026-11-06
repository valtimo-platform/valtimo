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

import {NgTemplateOutlet} from '@angular/common';
import {ChangeDetectionStrategy, Component, computed} from '@angular/core';
import {ReactiveFormsModule} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {ValuePathSelectorComponent, ValuePathSelectorPrefix} from '@valtimo/components';
import {
  BuildingBlockInputMappingDto,
  BuildingBlockOutputMappingDto,
  BuildingBlockReferenceUpdateDifferencesDto,
} from '@valtimo/shared';
import {InputModule, SelectModule, TagModule} from 'carbon-components-angular';
import {BUILDING_BLOCK_MANAGEMENT_REFERENCE_UPDATE_TEST_IDS} from '../../../constants';
import {ReferenceUpdateChainMappings, ValuePathContext} from '../../../models';
import {BuildingBlockReferenceUpdateWizardService} from '../building-block-reference-update-wizard.service';
import {BuildingBlockReferenceUpdateChainPathComponent} from '../reference-update-chain-path/reference-update-chain-path.component';
import {BuildingBlockReferenceUpdatePreviewStatusComponent} from '../reference-update-preview-status/reference-update-preview-status.component';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-reference-update-differences-step',
  templateUrl: './reference-update-differences-step.component.html',
  styleUrls: ['../styles/reference-update-step.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    TranslateModule,
    InputModule,
    SelectModule,
    TagModule,
    ValuePathSelectorComponent,
    BuildingBlockReferenceUpdateChainPathComponent,
    BuildingBlockReferenceUpdatePreviewStatusComponent,
  ],
})
export class BuildingBlockReferenceUpdateDifferencesStepComponent {
  protected readonly testIds = BUILDING_BLOCK_MANAGEMENT_REFERENCE_UPDATE_TEST_IDS;

  public readonly SOURCE_PREFIXES = [ValuePathSelectorPrefix.DOC, ValuePathSelectorPrefix.CASE];

  public readonly resolutionForm = this.wizardService.resolutionForm;

  public readonly $invalidInputs = this.wizardService.$invalidInputs;
  public readonly $pluginConfigurations = this.wizardService.$pluginConfigurations;
  public readonly $selectedChains = this.wizardService.$selectedChains;
  public readonly $targetKey = this.wizardService.$targetKey;
  public readonly $target = this.wizardService.$target;

  // The link's mappings as they will be after the update, so admins recognise their own configuration
  public readonly $mappings = computed(
    (): Record<string, ReferenceUpdateChainMappings> =>
      Object.fromEntries(
        this.$selectedChains().map(chain => [chain.id, this.toMappings(chain.differences)])
      )
  );

  // Inputs read from the document of the container that holds the link.
  public readonly $hasDropped = computed(
    (): Record<string, {inputs: boolean; outputs: boolean}> =>
      Object.fromEntries(
        Object.entries(this.$mappings()).map(([chainId, mappings]) => [
          chainId,
          {
            inputs: mappings.inputs.some(row => row.status === 'dropped'),
            outputs: mappings.outputs.some(row => row.status === 'dropped'),
          },
        ])
      )
  );

  public readonly $sourceContexts = computed(
    (): Record<string, ValuePathContext> =>
      Object.fromEntries(
        this.$selectedChains().map(chain => {
          const {type, key, versionTag} = chain.link.container;
          return [
            chain.id,
            type === 'CASE'
              ? {caseDefinitionKey: key, caseDefinitionVersionTag: versionTag}
              : {buildingBlockKey: key, buildingBlockVersionTag: versionTag},
          ];
        })
      )
  );

  constructor(private readonly wizardService: BuildingBlockReferenceUpdateWizardService) {}

  private toMappings(
    differences: BuildingBlockReferenceUpdateDifferencesDto
  ): ReferenceUpdateChainMappings {
    const isDropped = (
      mapping: BuildingBlockInputMappingDto | BuildingBlockOutputMappingDto,
      dropped: Array<BuildingBlockInputMappingDto | BuildingBlockOutputMappingDto>
    ): boolean =>
      dropped.some(
        droppedMapping =>
          droppedMapping.source === mapping.source && droppedMapping.target === mapping.target
      );

    return {
      inputs: [
        ...differences.existingInputMappings.map(mapping => ({
          status: isDropped(mapping, differences.droppedInputMappings)
            ? ('dropped' as const)
            : ('kept' as const),
          source: mapping.source,
          target: mapping.target,
        })),
        ...differences.missingRequiredInputs.map(field => ({
          status: 'added' as const,
          source: '',
          target: field,
        })),
      ],
      outputs: differences.existingOutputMappings.map(mapping => ({
        status: isDropped(mapping, differences.droppedOutputMappings)
          ? ('dropped' as const)
          : ('kept' as const),
        source: mapping.source,
        target: mapping.target,
        syncTiming: mapping.syncTiming,
      })),
    };
  }
}
