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
import {FormArray, FormControl, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {Add16, TrashCan16} from '@carbon/icons';
import {
  OverflowMenuComponent,
  OverflowMenuOptionComponent,
  OverflowMenuTriggerComponent,
} from '@valtimo/components';
import {FormFlowExpressionMethodDto, FormFlowRegistryDto} from '@valtimo/shared';
import {ButtonModule, IconModule, IconService, InputModule} from 'carbon-components-angular';
import {FORM_FLOW_EDITOR_TEST_IDS} from '../../../../../constants';
import {FormFlowEditorFormService} from '../../../../../services/form-flow-editor-form.service';

interface ExpressionSuggestion {
  label: string;
  expression: string;
}

/**
 * Editable list of SpEL expressions for one of a step's lifecycle hooks (on open, on complete,
 * on back). The add-menu offers the expression beans from the form flow registry as ready-made
 * templates next to a blank expression.
 */
@Component({
  standalone: true,
  selector: 'valtimo-form-flow-expression-list',
  templateUrl: './form-flow-expression-list.component.html',
  styleUrls: ['./form-flow-expression-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ButtonModule,
    IconModule,
    InputModule,
    OverflowMenuComponent,
    OverflowMenuOptionComponent,
    OverflowMenuTriggerComponent,
  ],
})
export class FormFlowExpressionListComponent {
  @Input() public expressions!: FormArray;
  @Input() public label = '';
  @Input() public description = '';
  @Input() public readOnly: boolean | null = false;

  @Input() public set registry(registry: FormFlowRegistryDto | null) {
    this.suggestions = (registry?.expressionBeans ?? []).flatMap(bean =>
      bean.methods.map(method => {
        const call = `${bean.name}.${this.formatMethod(method)}`;
        return {label: call, expression: `\${${call}}`};
      })
    );
  }

  public suggestions: ExpressionSuggestion[] = [];

  protected readonly testIds = FORM_FLOW_EDITOR_TEST_IDS;

  constructor(
    private readonly formService: FormFlowEditorFormService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Add16, TrashCan16]);
  }

  public get expressionControls(): FormControl[] {
    return this.expressions.controls as FormControl[];
  }

  public addExpression(expression = ''): void {
    this.expressions.push(this.formService.buildExpressionControl(expression));
    this.expressions.markAsDirty();
  }

  public removeExpression(index: number): void {
    this.expressions.removeAt(index);
    this.expressions.markAsDirty();
  }

  private formatMethod(method: FormFlowExpressionMethodDto): string {
    return `${method.name}(${method.parameters.map(parameter => parameter.name).join(', ')})`;
  }
}
