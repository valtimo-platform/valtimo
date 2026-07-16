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
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {
  ButtonModule,
  CheckboxModule,
  DatePickerInputModule,
  DatePickerModule,
  DropdownModule,
  LayerModule,
  ListItem,
  ModalModule,
} from 'carbon-components-angular';
import {TooltipIconModule, ValtimoCdsModalDirective} from '@valtimo/components';
import {StartReindexRequestDto} from '../../models';

@Component({
  standalone: true,
  selector: 'valtimo-start-reindex-modal',
  templateUrl: './start-reindex-modal.component.html',
  styleUrls: ['./start-reindex-modal.component.scss'],
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    ModalModule,
    ValtimoCdsModalDirective,
    ButtonModule,
    CheckboxModule,
    DatePickerInputModule,
    DatePickerModule,
    DropdownModule,
    LayerModule,
    TooltipIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StartReindexModalComponent {
  @Input() public open = false;
  @Input() public documentDefinitions: ListItem[] = [];

  @Output() public readonly closeEvent = new EventEmitter<StartReindexRequestDto | null>();

  public readonly formGroup: FormGroup = this._fb.group({
    pruneOrphans: [false],
    documentDefinitionName: [null],
    modifiedAfter: [null],
  });

  constructor(private readonly _fb: FormBuilder) {}

  public onDateSelected(event: string[]): void {
    const dateValue = event?.[0] || null;
    this.formGroup.patchValue({modifiedAfter: dateValue});
  }

  public onCancel(): void {
    this._resetForm();
    this.closeEvent.emit(null);
  }

  public onSubmit(): void {
    const request = this._buildRequest();
    this._resetForm();
    this.closeEvent.emit(request);
  }

  private _buildRequest(): StartReindexRequestDto {
    const formValue = this.formGroup.value;
    const request: StartReindexRequestDto = {};

    if (formValue.pruneOrphans) {
      request.pruneOrphans = true;
    }

    if (formValue.documentDefinitionName?.value) {
      request.documentDefinitionName = formValue.documentDefinitionName.value;
    }

    if (formValue.modifiedAfter) {
      request.modifiedAfter = this._formatDateToIso(formValue.modifiedAfter);
    }

    return request;
  }

  private _formatDateToIso(date: string | Date): string {
    if (date instanceof Date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}T00:00:00`;
    }
    const parts = date.split('-');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month}-${day}T00:00:00`;
    }
    return date;
  }

  private _resetForm(): void {
    this.formGroup.reset({
      pruneOrphans: false,
      documentDefinitionName: null,
      modifiedAfter: null,
    });
  }
}
