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
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {CaseManagementParams} from '@valtimo/shared';
import {ButtonModule, InputModule, LayerModule, ModalModule} from 'carbon-components-angular';
import {Observable} from 'rxjs';
import {CASE_MANAGEMENT_CONFIGURATION_MODAL_TEST_IDS} from '../../../../../constants';
import {CaseConfigurationItem, StatusModalCloseEvent} from '../../../../../models';
import {CaseConfigurationApiService} from '../../../../../services';

const KEY_PATTERN = /^[A-Za-z0-9_.-]+$/;

@Component({
  standalone: true,
  selector: 'valtimo-case-management-configuration-modal',
  templateUrl: './case-management-configuration-modal.component.html',
  styleUrls: ['./case-management-configuration-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    ModalModule,
    ValtimoCdsModalDirective,
    InputModule,
    ButtonModule,
    LayerModule,
  ],
})
export class CaseManagementConfigurationModalComponent implements OnChanges {
  @Input() public item: CaseConfigurationItem | null = null;
  @Input() public open = false;
  @Input() public params: CaseManagementParams | null = null;
  @Input() public usedKeys: string[] = [];

  @Output() public closeEvent = new EventEmitter<StatusModalCloseEvent>();

  public readonly $disabled = signal<boolean>(false);
  public readonly $isEdit = signal<boolean>(false);

  protected readonly testIds = CASE_MANAGEMENT_CONFIGURATION_MODAL_TEST_IDS;

  public readonly formGroup = this.fb.group({
    key: this.fb.control('', [
      Validators.required,
      Validators.pattern(KEY_PATTERN),
      this.uniqueKeyValidator.bind(this),
    ]),
    defaultValue: this.fb.control(''),
  });

  public get key(): AbstractControl<string | null> {
    return this.formGroup.controls.key;
  }

  constructor(
    private readonly caseConfigurationApiService: CaseConfigurationApiService,
    private readonly fb: FormBuilder
  ) {}

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) this.prefillForm();
  }

  public close(): void {
    this.closeEvent.emit('close');
  }

  public save(): void {
    if (!this.params || this.formGroup.invalid) return;

    const {key, defaultValue} = this.formGroup.getRawValue();
    const request$: Observable<CaseConfigurationItem> = this.$isEdit()
      ? this.caseConfigurationApiService.updateConfiguration(this.params, key ?? '', {
          defaultValue: defaultValue ?? '',
        })
      : this.caseConfigurationApiService.createConfiguration(this.params, {
          key: key ?? '',
          defaultValue: defaultValue ?? '',
        });

    this.disable();
    request$.subscribe({
      next: () => {
        this.enable();
        this.closeEvent.emit('closeAndRefresh');
      },
      error: () => this.enable(),
    });
  }

  private prefillForm(): void {
    const isEdit = !!this.item;
    this.$isEdit.set(isEdit);
    this.enable();
    this.formGroup.reset({
      key: this.item?.key ?? '',
      defaultValue: this.item?.defaultValue ?? '',
    });
    if (isEdit) this.key.disable();
  }

  private uniqueKeyValidator(control: AbstractControl): ValidationErrors | null {
    if (this.$isEdit?.() || !control.value) return null;
    return (this.usedKeys ?? []).includes(control.value) ? {uniqueKey: true} : null;
  }

  private disable(): void {
    this.$disabled.set(true);
    this.formGroup.disable();
  }

  private enable(): void {
    this.$disabled.set(false);
    this.formGroup.enable();
    if (this.$isEdit()) this.key.disable();
  }
}
