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
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {EditorModel} from '@valtimo/components';
import {FormFlowRegistryDto} from '@valtimo/shared';
import {LoadingModule, StructuredListModule, TagModule} from 'carbon-components-angular';
import {Observable} from 'rxjs';
import {FORM_FLOW_EDITOR_TEST_IDS} from '../../../../constants';
import {
  CustomComponentStepTypeProperties,
  FormFlowDefinition,
  FormFlowStep,
  FormStepTypeProperties,
} from '../../../../models';
import {FormFlowService} from '../../../../services';

@Component({
  standalone: true,
  selector: 'valtimo-form-flow-ui-editor-tab',
  templateUrl: './form-flow-ui-editor-tab.component.html',
  styleUrls: ['./form-flow-ui-editor-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, LoadingModule, StructuredListModule, TagModule],
})
export class FormFlowUiEditorTabComponent implements OnChanges {
  @Input() public model: EditorModel | null = null;
  @Input() public readOnly: boolean | null = false;

  // The visual editor emits the modified definition as JSON through the same contract as the JSON
  // editor tab, so the surrounding editor page treats both tabs identically.
  @Output() public validEvent = new EventEmitter<boolean>();
  @Output() public valueChangeEvent = new EventEmitter<string>();

  public readonly $definition = signal<FormFlowDefinition | null>(null);

  public readonly registry$: Observable<FormFlowRegistryDto> =
    this.formFlowService.getFormFlowRegistry();

  protected readonly testIds = FORM_FLOW_EDITOR_TEST_IDS;

  constructor(private readonly formFlowService: FormFlowService) {}

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['model']) {
      this.$definition.set(this.parseDefinition(this.model));
    }
  }

  public isKnownStepType(step: FormFlowStep, registry: FormFlowRegistryDto): boolean {
    return registry.stepTypes.some(stepType => stepType.name === step.type?.name);
  }

  public getStepTypeDetail(step: FormFlowStep): string {
    const properties = step.type?.properties;
    if (!properties) return '';

    return (
      (properties as FormStepTypeProperties).definition ??
      (properties as CustomComponentStepTypeProperties).componentId ??
      ''
    );
  }

  public getExpressionCount(step: FormFlowStep): number {
    return (step.onOpen?.length ?? 0) + (step.onComplete?.length ?? 0) + (step.onBack?.length ?? 0);
  }

  private parseDefinition(model: EditorModel | null): FormFlowDefinition | null {
    if (!model?.value) return null;

    try {
      return JSON.parse(model.value) as FormFlowDefinition;
    } catch {
      return null;
    }
  }
}
