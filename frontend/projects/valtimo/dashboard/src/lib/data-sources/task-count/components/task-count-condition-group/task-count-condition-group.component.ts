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

import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {ListItemWithId, MultiInputValues} from '@valtimo/components';
import {Add16, TrashCan16} from '@carbon/icons';
import {IconService} from 'carbon-components-angular';
import {isEqual} from 'lodash';
import {ConditionGroupForm, ConditionGroupOperator} from '../../models';
import {TASK_COUNT_TEST_IDS} from '../../constants';
import {createConditionGroup, createEmptyConditionRow} from '../../utils';

/**
 * A single condition group in the task count configuration: an AND/OR selector, the group's own
 * condition rows, and its nested groups. The component renders itself recursively, so groups can
 * be nested to any depth - matching the backend `AndConditionGroup`/`OrConditionGroup` tree.
 *
 * The group object is mutated in place and [groupChange] is emitted so the root configuration
 * component can re-serialize the whole tree.
 */
@Component({
  standalone: false,
  selector: 'valtimo-task-count-condition-group',
  templateUrl: './task-count-condition-group.component.html',
  styleUrls: ['./task-count-condition-group.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskCountConditionGroupComponent {
  @Input() public set group(groupValue: ConditionGroupForm) {
    this._group = groupValue;
    // Captured once per group instance: binding the live rows back into the multi-input would
    // overwrite the user's input on every keystroke.
    this.initialRows = groupValue?.rows?.length ? [...groupValue.rows] : null;
  }

  public get group(): ConditionGroupForm {
    return this._group;
  }

  @Input() public dataSourceKey: string;
  @Input() public disabled = false;
  @Input() public operatorItems: Array<ListItemWithId> = [];
  /** The outermost group cannot be deleted and starts out without condition rows. */
  @Input() public root = false;
  /**
   * Position of this group in the tree ('root', 'root-0', 'root-0-1', ...). Only used to keep the
   * test ids unique across the recursion, so that a test can target one specific group.
   */
  @Input() public groupId = 'root';

  @Output() public groupChange = new EventEmitter<void>();
  @Output() public deleteGroup = new EventEmitter<void>();

  public initialRows: MultiInputValues | null = null;

  public readonly testIds = TASK_COUNT_TEST_IDS;

  /**
   * Index of the connector that carries the interactive operator selector.
   *
   * The root renders a connector between every pair of sections, but a group has a single operator,
   * so all of them would set the same value. Only this one is a selector; the rest mirror it as
   * static text, to avoid suggesting that the sections can be joined by different operators.
   */
  public get interactiveConnectorIndex(): number {
    return this._group.rows.length ? 0 : 1;
  }

  private _group: ConditionGroupForm;

  constructor(private readonly iconService: IconService) {
    this.iconService.registerAll([Add16, TrashCan16]);
  }

  /**
   * Qualifies a test id with this group's position, plus an index for the elements that a single
   * group renders more than once (the root operator repeats between every pair of sections).
   */
  public testId(base: string, index?: number): string {
    return index === undefined ? `${base}--${this.groupId}` : `${base}--${this.groupId}-${index}`;
  }

  public setOperator(operator: ConditionGroupOperator): void {
    if (this._group.operator === operator) {
      return;
    }

    this._group.operator = operator;
    this.groupChange.emit();
  }

  public rowsValueChange(values: MultiInputValues): void {
    if (isEqual(this._group.rows, values)) {
      return;
    }

    this._group.rows = values;
    this.groupChange.emit();
  }

  /**
   * Appends a section to this group, leaving the operator of the group untouched.
   *
   * How the sections relate is a single property of this group, shown on the connectors between
   * them and changed there with [setOperator]. An addition deliberately does not ask for it: the
   * operator of the group and the operator inside a section are two different levels, and the first
   * addition has nothing to relate the new section to yet. The new section starts out combining its
   * own conditions with 'and'; that operator is changed in the header of the section itself.
   */
  public addGroup(): void {
    this._group.groups = [
      ...this._group.groups,
      createConditionGroup('and', [createEmptyConditionRow()]),
    ];
    this.groupChange.emit();
  }

  public removeGroup(group: ConditionGroupForm): void {
    this._group.groups = this._group.groups.filter(nestedGroup => nestedGroup !== group);
    this.groupChange.emit();
  }
}
