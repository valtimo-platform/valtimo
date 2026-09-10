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
import {ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {FormArray, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {Add16, ArrowDown16, ArrowUp16, TrashCan16} from '@carbon/icons';
import {TooltipIconModule} from '@valtimo/components';
import {
  ButtonModule,
  DropdownModule,
  IconModule,
  IconService,
  InputModule,
  ListItem,
} from 'carbon-components-angular';
import {FORM_FLOW_EDITOR_TEST_IDS} from '../../../../../constants';
import {FormFlowEditorFormService} from '../../../../../services/form-flow-editor-form.service';

/**
 * Editable list of a step's outgoing transitions. Transitions are evaluated top to bottom — the
 * first entry whose condition holds is taken and a condition-less entry acts as the default — so
 * the rows can be reordered.
 */
@Component({
  standalone: true,
  selector: 'valtimo-form-flow-transition-list',
  templateUrl: './form-flow-transition-list.component.html',
  styleUrls: ['./form-flow-transition-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ButtonModule,
    DropdownModule,
    IconModule,
    InputModule,
    TooltipIconModule,
  ],
})
export class FormFlowTransitionListComponent implements OnChanges {
  @Input() public transitions!: FormArray;
  @Input() public stepKeys: string[] = [];
  @Input() public readOnly: boolean | null = false;
  /** While false the admin is still modelling and empty-target errors stay hidden; a save attempt
   * flips it to reveal them. */
  @Input() public revealErrors = false;

  protected readonly testIds = FORM_FLOW_EDITOR_TEST_IDS;

  // Per-row dropdown items, cached per transition group. The Carbon dropdown resets its visual
  // selection whenever its items array is swapped, so the array is only rebuilt when the step keys
  // or the row's own selection actually change.
  private readonly _rowItems = new WeakMap<
    FormGroup,
    {keys: string[]; value: string; items: ListItem[]}
  >();

  constructor(
    private readonly formService: FormFlowEditorFormService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Add16, ArrowDown16, ArrowUp16, TrashCan16]);
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['stepKeys']) {
      // A new keys reference invalidates every cached row; rows lazily rebuild on the next read.
      this.transitionGroups.forEach(group => this._rowItems.delete(group));
    }
  }

  public get transitionGroups(): FormGroup[] {
    return this.transitions.controls as FormGroup[];
  }

  public getRowItems(transitionGroup: FormGroup): ListItem[] {
    const value = transitionGroup.get('step')?.value ?? '';
    const cached = this._rowItems.get(transitionGroup);
    if (cached && cached.keys === this.stepKeys && cached.value === value) {
      return cached.items;
    }

    const items = this.stepKeys.map(key => ({content: key, id: key, selected: key === value}));
    this._rowItems.set(transitionGroup, {keys: this.stepKeys, value, items});
    return items;
  }

  public addTransition(): void {
    this.transitions.push(this.formService.buildTransitionGroup());
    this.transitions.markAsDirty();
  }

  public removeTransition(index: number): void {
    this.transitions.removeAt(index);
    this.transitions.markAsDirty();
  }

  public moveTransition(index: number, offset: -1 | 1): void {
    const target = index + offset;
    if (target < 0 || target >= this.transitions.length) return;

    const control = this.transitions.at(index);
    this.transitions.removeAt(index);
    this.transitions.insert(target, control);
    this.transitions.markAsDirty();
  }
}
