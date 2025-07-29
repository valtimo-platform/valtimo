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
import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {CARBON_CONSTANTS, ValtimoCdsModalDirective} from '@valtimo/components';
import {ButtonModule, InputModule, LayerModule, ModalModule} from 'carbon-components-angular';
import {IkoDataRequestResponse} from '../../../../../models';

@Component({
  selector: 'valtimo-iko-management-search-action-modal',
  templateUrl: './search-action-modal.component.html',
  styleUrl: './search-action-modal.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputModule,
    TranslateModule,
    ModalModule,
    ValtimoCdsModalDirective,
    ButtonModule,
    LayerModule,
  ],
})
export class IkoManagementSearchActionModalComponent {
  public readonly $modalType = signal<'add' | 'edit'>('add');
  public readonly $isOpen = signal<boolean>(false);
  @Input() public set open(value: boolean) {
    this.$isOpen.set(value);

    if (value) return;

    setTimeout(() => {
      this.$modalType.set('add');
      this.formGroup.reset();
      this.formGroup.get('key')?.enable();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
  @Input() public set prefillData(value: IkoDataRequestResponse | null) {
    if (!value) return;

    this.$modalType.set('edit');
    this.formGroup.patchValue(value);
    this.formGroup.get('key')?.disable();
  }
  @Input() aggregateKey: string;

  @Output() public readonly modalClose = new EventEmitter<IkoDataRequestResponse | null>();

  public readonly formGroup = this.fb.group({
    key: this.fb.control<string>('', Validators.required),
    title: this.fb.control<string>('', Validators.required),
    ikoDataAggregateKey: this.fb.control<string>(''),
    properties: this.fb.control<Record<string, any | null>>({}),
  });

  constructor(private readonly fb: FormBuilder) {}

  public onCancel(): void {
    this.modalClose.emit(null);
  }

  public onSave(): void {
    this.modalClose.emit({
      key: this.formGroup.get('key')?.value ?? '',
      title: this.formGroup.get('title')?.value ?? '',
      ikoDataAggregateKey: this.formGroup.get('ikoDataAggregateKey')?.value ?? this.aggregateKey,
      properties: this.formGroup.get('properties')?.value ?? {},
    });
  }
}
