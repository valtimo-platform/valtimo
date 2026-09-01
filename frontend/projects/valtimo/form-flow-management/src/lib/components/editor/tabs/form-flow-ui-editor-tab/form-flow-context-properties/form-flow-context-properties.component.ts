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

import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {FormFlowAdditionalPropertyDto, FormFlowRegistryDto} from '@valtimo/shared';
import {translateWithFallback} from '../../../../../utils';

interface ContextPropertyGroup {
  labelKey: string;
  properties: FormFlowAdditionalPropertyDto[];
}

/**
 * Lists the `additionalProperties` entries that expressions can rely on, grouped by how the form
 * flow is linked (user task or start event). The property names come from the form flow registry,
 * so this always matches what the backend actually provides.
 */
@Component({
  standalone: true,
  selector: 'valtimo-form-flow-context-properties',
  templateUrl: './form-flow-context-properties.component.html',
  styleUrls: ['./form-flow-context-properties.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule],
})
export class FormFlowContextPropertiesComponent {
  @Input() public set registry(registry: FormFlowRegistryDto | null) {
    const properties = registry?.additionalProperties ?? [];

    this.groups = [
      {labelKey: 'formFlow.uiEditor.additionalPropertiesUserTask', context: 'userTask'},
      {labelKey: 'formFlow.uiEditor.additionalPropertiesStartEvent', context: 'startEvent'},
    ]
      .map(group => ({
        labelKey: group.labelKey,
        properties: properties.filter(property => property.context === group.context),
      }))
      .filter(group => group.properties.length > 0);
  }

  public groups: ContextPropertyGroup[] = [];

  constructor(private readonly translateService: TranslateService) {}

  public getDescription(property: FormFlowAdditionalPropertyDto): string {
    return translateWithFallback(
      this.translateService,
      `formFlow.uiEditor.additionalProperties.${property.name}`,
      ''
    );
  }
}
