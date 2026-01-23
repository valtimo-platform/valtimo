/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import {FormCustomComponent} from '@valtimo/process-link';

@Component({
  selector: 'app-dummy-form-custom-component',
  template: `
    <div class="dummy-form-component">
      <h2>Dummy Form Custom Component</h2>
      <p><strong>Task Instance ID:</strong> {{ taskInstanceId }}</p>
      <p><strong>Process Definition Key:</strong> {{ processDefinitionKey }}</p>
      <p><strong>Document Definition Name:</strong> {{ documentDefinitionName }}</p>
      <button (click)="onSubmit()">Submit Dummy Data</button>
    </div>
  `,
  styles: [
    `
      .dummy-form-component {
        border: 1px solid #ccc;
        padding: 1rem;
        border-radius: 8px;
      }
    `,
  ],
  standalone: true,
})
export class CustomFormComponent implements FormCustomComponent {
  @Input() taskInstanceId: string | null = null;
  @Input() processDefinitionKey: string | null = null;
  @Input() documentDefinitionName: string | null = null;
  @Output() submittedEvent: EventEmitter<any> = new EventEmitter<any>();

  public onSubmit(): void {
    const dummyPayload = {
      taskInstanceId: this.taskInstanceId,
      processDefinitionKey: this.processDefinitionKey,
      documentDefinitionName: this.documentDefinitionName,
      data: 'This is a dummy submission',
    };

    this.submittedEvent.emit(dummyPayload);
  }
}
