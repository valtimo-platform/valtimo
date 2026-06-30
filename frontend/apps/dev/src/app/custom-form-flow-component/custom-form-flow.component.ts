/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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

import {Component, EventEmitter, Input, Output} from '@angular/core';
import {ChangeEvent, FormFlowCustomComponent} from '@valtimo/process-link';
import {FormioSubmission} from '@valtimo/components';

@Component({
  standalone: true,
  selector: 'app-custom-form-flow',
  templateUrl: './custom-form-flow.component.html',
  styleUrls: ['./custom-form-flow.component.scss'],
})
export class CustomFormFlowComponent implements FormFlowCustomComponent {
  @Input() formFlowInstanceId!: string;
  @Input() componentId!: string;
  @Input() disabled!: boolean;

  @Output() changeEvent = new EventEmitter<ChangeEvent>();
  @Output() submitEvent = new EventEmitter<FormioSubmission>();

  public onSubmit(): void {
    this.submitEvent.emit({
      data: {
        submit: true,
      },
      metadata: {},
      state: '',
    });
  }

  public onBack(): void {
    this.submitEvent.emit({
      data: {
        back: true,
      },
      metadata: {},
      state: '',
    });
  }
}
