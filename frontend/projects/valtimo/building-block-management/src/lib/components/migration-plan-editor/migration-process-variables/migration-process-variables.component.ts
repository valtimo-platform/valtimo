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
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {Add16, TrashCan16} from '@carbon/icons';
import {
  ButtonModule,
  IconModule,
  IconService,
  InputModule,
  SelectModule,
} from 'carbon-components-angular';
import {ValuePathSelectorComponent, ValuePathSelectorPrefix} from '@valtimo/components';
import {Subscription} from 'rxjs';
import {
  DataMigrationTargetType,
  MigrationEditorTestIds,
  PatchMode,
  ValuePathContext,
} from '../../../models';
import {createProcessVariableGroup} from '../../../utils';

/** The `setProcessVariables` half of one `processMigration` instruction. */
@Component({
  standalone: true,
  selector: 'valtimo-migration-process-variables',
  templateUrl: './migration-process-variables.component.html',
  styleUrls: [
    '../styles/migration-tab.component.scss',
    './migration-process-variables.component.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ButtonModule,
    IconModule,
    InputModule,
    SelectModule,
    ValuePathSelectorComponent,
  ],
})
export class MigrationProcessVariablesComponent {
  /** The instruction's own `setProcessVariables` array — mutated in place, so the host's form stays the single source of truth. */
  @Input() public variables!: FormArray;

  /** The host's container for each row's mode subscription. A row outlives this component, which is rebuilt on every expand. */
  @Input() public subscriptions!: Subscription;

  /** Document context for the source selector. The target is a plain `pv:` path. */
  @Input() public sourceContext: ValuePathContext | null = null;

  @Input() public sourcePrefixes: ValuePathSelectorPrefix[] = [ValuePathSelectorPrefix.DOC];

  @Input() public testIds: MigrationEditorTestIds | null = null;

  public readonly MODES: PatchMode[] = ['path', 'value', 'null'];

  public readonly TARGET_TYPES: DataMigrationTargetType[] = [
    'string',
    'integer',
    'long',
    'number',
    'double',
    'boolean',
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Add16, TrashCan16]);
  }

  /** The row's control as the group it is — `FormArray.controls` is typed as the abstract base. */
  public asGroup(variable: AbstractControl): FormGroup {
    return variable as FormGroup;
  }

  public addVariable(): void {
    this.variables.push(createProcessVariableGroup(this.fb, this.subscriptions));
  }

  public removeVariable(index: number): void {
    this.variables.removeAt(index);
  }
}
