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
import {AbstractControl, FormArray, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {Add16, TrashCan16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {
  ButtonModule,
  IconModule,
  IconService,
  InputModule,
  LayerModule,
  SelectModule,
} from 'carbon-components-angular';
import {VALUE_CONDITION_TREE_TEST_IDS} from '../../constants';
import {ValueConditionGroupMode, ValueConditionKind, ValuePathSelectorPrefix} from '../../models';
import {ValueConditionTreeService} from '../../services';
import {ValuePathSelectorComponent} from '../value-path-selector/value-path-selector.component';

/**
 * The comparison operators a condition can use. `in` takes a comma-separated list of values,
 * `exists` takes no value (or `false` to require the value to be absent).
 */
const DEFAULT_CONDITION_OPERATORS = ['==', '!=', '>', '>=', '<', '<=', 'in', 'contains', 'exists'];

/**
 * Editor for a tree of conditions: rows of `path / operator / value`, optionally wrapped in AND/OR
 * groups that may nest. Renders itself for every nested group, so one component covers any depth.
 *
 * The `conditions` [FormArray] is built and read back with [ValueConditionTreeService], which also
 * owns the mapping to and from the JSON shape (`allOf` / `anyOf`).
 */
@Component({
  standalone: true,
  selector: 'valtimo-value-condition-tree',
  templateUrl: './value-condition-tree.component.html',
  styleUrls: ['./value-condition-tree.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ButtonModule,
    IconModule,
    InputModule,
    LayerModule,
    SelectModule,
    ValuePathSelectorComponent,
  ],
})
export class ValueConditionTreeComponent {
  @Input() public conditions!: FormArray;
  // The definition the paths are resolved against — a case definition version or a building block
  // definition version, depending on which editor hosts the tree.
  @Input() public caseDefinitionKey: string | null = null;
  @Input() public caseDefinitionVersionTag: string | null = null;
  @Input() public buildingBlockDefinitionKey: string | null = null;
  @Input() public buildingBlockDefinitionVersionTag: string | null = null;
  @Input() public prefixes: ValuePathSelectorPrefix[] = [];
  /** Override to offer a different set; the default is what the condition evaluators support. */
  @Input() public operators: string[] = DEFAULT_CONDITION_OPERATORS;
  /** How deep this tree sits; 0 for the outermost list. Drives nesting depth and styling. */
  @Input() public depth = 0;
  /** How deep groups may nest in total. Matches the backend's limit. */
  @Input() public maxDepth = 10;
  /** Test ids for the outermost add buttons, so a consuming screen keeps its own e2e handles. */
  @Input() public addConditionTestId: string | null = null;
  @Input() public addGroupTestId: string | null = null;

  protected readonly testIds = VALUE_CONDITION_TREE_TEST_IDS;

  public readonly GROUP_MODES: ValueConditionGroupMode[] = ['anyOf', 'allOf'];

  // Carbon provides three layer tokens, of which two contrast with each other, so nesting levels
  // alternate between them to keep each level distinct from the one it sits on.
  public get rowLayerLevel(): 1 | 2 {
    return this.depth % 2 === 0 ? 1 : 2;
  }

  // Inputs use the layer that contrasts with their own row, so a field always stands out from it.
  public get inputLayerLevel(): 1 | 2 {
    return this.rowLayerLevel === 1 ? 2 : 1;
  }

  public get canNest(): boolean {
    return this.depth + 1 < this.maxDepth;
  }

  constructor(
    private readonly conditionTreeService: ValueConditionTreeService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Add16, TrashCan16]);
  }

  public asFormGroup(control: AbstractControl): FormGroup {
    return control as FormGroup;
  }

  public kindOf(index: number): ValueConditionKind {
    return this.groupAt(index).get('kind')?.value ?? 'condition';
  }

  public nestedConditions(index: number): FormArray {
    return this.groupAt(index).get('conditions') as FormArray;
  }

  public addCondition(): void {
    this.conditions.push(this.conditionTreeService.createNodeGroup());
  }

  public addGroup(): void {
    // Seeded with one empty condition so the group starts out usable. It stays out of the saved plan
    // until a path is filled in, because an empty group is dropped on serialization.
    this.conditions.push(
      this.conditionTreeService.createNodeGroup({anyOf: [{path: '', operator: '==', value: ''}]})
    );
  }

  public removeNode(index: number): void {
    this.conditions.removeAt(index);
  }

  private groupAt(index: number): FormGroup {
    return this.conditions.at(index) as FormGroup;
  }
}
