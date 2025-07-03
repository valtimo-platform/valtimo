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

import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {FormBuilder, Validators} from '@angular/forms';
import {TimelineItem} from '@valtimo/components';

@Component({
  selector: 'valtimo-note-modal',
  templateUrl: './note-modal.component.html',
  styleUrl: './note-modal.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoteModalComponent {
  @Input() modalType: 'add' | 'modify';
  private _customData: TimelineItem | null;
  @Input() public set customData(value: TimelineItem | null) {
    this._customData = value;
    if (!value) {
      this.formGroup.reset();
      return;
    }

    this.formGroup.get('content')?.setValue(value.summaryTranslationKey ?? '');
  }
  @Input() public open;
  @Output() public readonly modalClosed = new EventEmitter<null | Partial<{
    id: string;
    content: string;
  }>>();

  public readonly formGroup = this.fb.group({
    content: this.fb.control('', Validators.required),
  });

  constructor(private readonly fb: FormBuilder) {}

  public onCancel(): void {
    this.modalClosed.emit(null);
  }

  public onConfirm(): void {
    const content = this.formGroup.get('content')?.value ?? '';
    this.modalClosed.emit({
      content,
      ...(!!this._customData && {id: this._customData?.customData?.['id'] ?? ''}),
    });
  }
}
