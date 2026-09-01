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
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {Add16, WarningFilled16} from '@carbon/icons';
import {ButtonModule, IconModule, IconService, TagModule} from 'carbon-components-angular';
import {FORM_FLOW_EDITOR_TEST_IDS} from '../../../../../constants';

interface FormFlowStepListItem {
  key: string;
  title: string;
  typeName: string;
  isStart: boolean;
  invalid: boolean;
}

/** Clickable overview of all steps in the flow, ordered as defined, with the start step first. */
@Component({
  standalone: true,
  selector: 'valtimo-form-flow-step-list',
  templateUrl: './form-flow-step-list.component.html',
  styleUrls: ['./form-flow-step-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, ButtonModule, IconModule, TagModule],
})
export class FormFlowStepListComponent {
  @Input() public steps: FormFlowStepListItem[] = [];
  @Input() public selectedIndex: number | null = null;
  @Input() public readOnly: boolean | null = false;

  @Output() public selectEvent = new EventEmitter<number>();
  @Output() public addEvent = new EventEmitter<void>();

  protected readonly testIds = FORM_FLOW_EDITOR_TEST_IDS;

  constructor(private readonly iconService: IconService) {
    this.iconService.registerAll([Add16, WarningFilled16]);
  }
}

export {FormFlowStepListItem};
