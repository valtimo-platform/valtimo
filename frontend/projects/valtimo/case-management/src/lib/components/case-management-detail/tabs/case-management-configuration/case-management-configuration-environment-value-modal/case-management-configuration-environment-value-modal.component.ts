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
import {FormBuilder, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {CaseManagementParams} from '@valtimo/shared';
import {ButtonModule, InputModule, LayerModule, ModalModule} from 'carbon-components-angular';
import {CASE_MANAGEMENT_CONFIGURATION_ENVIRONMENT_VALUE_MODAL_TEST_IDS} from '../../../../../constants';
import {CaseConfigurationItem, StatusModalCloseEvent} from '../../../../../models';
import {CaseConfigurationApiService} from '../../../../../services';

@Component({
  standalone: true,
  selector: 'valtimo-case-management-configuration-environment-value-modal',
  templateUrl: './case-management-configuration-environment-value-modal.component.html',
  styleUrls: ['./case-management-configuration-environment-value-modal.component.scss'],
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
export class CaseManagementConfigurationEnvironmentValueModalComponent implements OnChanges {
  @Input() public item: CaseConfigurationItem | null = null;
  @Input() public open = false;
  @Input() public params: CaseManagementParams | null = null;

  @Output() public closeEvent = new EventEmitter<StatusModalCloseEvent>();

  public readonly $disabled = signal<boolean>(false);

  protected readonly testIds = CASE_MANAGEMENT_CONFIGURATION_ENVIRONMENT_VALUE_MODAL_TEST_IDS;

  public readonly formGroup = this.fb.group({
    value: this.fb.control(''),
  });

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
    if (!this.params || !this.item) return;

    this.disable();
    this.caseConfigurationApiService
      .setEnvironmentValue(this.params, this.item.key, {
        value: this.formGroup.getRawValue().value ?? '',
      })
      .subscribe({
        next: () => {
          this.enable();
          this.closeEvent.emit('closeAndRefresh');
        },
        error: () => this.enable(),
      });
  }

  private prefillForm(): void {
    this.enable();
    this.formGroup.reset({value: this.item?.environmentValue ?? ''});
  }

  private disable(): void {
    this.$disabled.set(true);
    this.formGroup.disable();
  }

  private enable(): void {
    this.$disabled.set(false);
    this.formGroup.enable();
  }
}
