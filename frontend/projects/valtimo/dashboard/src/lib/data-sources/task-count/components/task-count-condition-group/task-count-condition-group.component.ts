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
import {FormArray, FormControl} from '@angular/forms';
import {ListItemWithId, MultiInputValues} from '@valtimo/components';
import {Add16, TrashCan16} from '@carbon/icons';
import {IconService} from 'carbon-components-angular';
import {ConditionGroupForm, ConditionGroupOperator} from '../../models';
import {TASK_COUNT_TEST_IDS} from '../../constants';
import {createConditionGroup, createEmptyConditionRow} from '../../utils';

/**
 * A single condition group in the task count configuration: an AND/OR selector, the group's own
 * condition rows, and its nested groups. The component renders itself recursively, so groups can
 * be nested to any depth - matching the backend `AndConditionGroup`/`OrConditionGroup` tree.
 *
 * All state lives in the [group] form: the rows are bound to the multi input as a control, and a
 * nested group is a form in the `groups` array. Changes therefore reach the configuration component
 * through the form itself, without this component reporting them.
 */
@Component({
  standalone: false,
  selector: 'valtimo-task-count-condition-group',
  templateUrl: './task-count-condition-group.component.html',
  styleUrls: ['./task-count-condition-group.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskCountConditionGroupComponent {
  @Input() public group: ConditionGroupForm;
  @Input() public dataSourceKey: string;
  @Input() public disabled = false;
  @Input() public operatorItems: Array<ListItemWithId> = [];
  /** The outermost group cannot be deleted and starts out without condition rows. */
  @Input() public root = false;

  @Output() public deleteGroup = new EventEmitter<void>();

  protected readonly testIds = TASK_COUNT_TEST_IDS;

  public get operator(): ConditionGroupOperator {
    return this.group.controls.operator.value;
  }

  public get rowsControl(): FormControl<MultiInputValues> {
    return this.group.controls.rows;
  }

  public get groups(): FormArray<ConditionGroupForm> {
    return this.group.controls.groups;
  }

  /**
   * Index of the connector that carries the interactive operator selector.
   *
   * The root renders a connector between every pair of sections, but a group has a single operator,
   * so all of them would set the same value. Only this one is a selector; the rest mirror it as
   * static text, to avoid suggesting that the sections can be joined by different operators.
   */
  public get interactiveConnectorIndex(): number {
    return this.rowsControl.value.length ? 0 : 1;
  }

  constructor(private readonly iconService: IconService) {
    this.iconService.registerAll([Add16, TrashCan16]);
  }

  public setOperator(operator: ConditionGroupOperator): void {
    if (this.operator === operator) {
      return;
    }

    this.group.controls.operator.setValue(operator);
  }

  /**
   * The multi input drops rows that are not filled in completely, so its value alone cannot tell a
   * half-filled group apart from a complete one. This event does, and marks the group invalid until
   * every row is either complete or removed.
   */
  public onAllRowsValid(allRowsValid: boolean): void {
    this.group.controls.rowsComplete.setValue(allRowsValid);
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
    this.groups.push(createConditionGroup('and', [createEmptyConditionRow()]));
  }

  public removeGroup(index: number): void {
    this.groups.removeAt(index);
  }
}
