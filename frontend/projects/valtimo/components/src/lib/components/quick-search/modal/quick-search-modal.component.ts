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
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {WarningFilled16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {
  ButtonModule,
  IconModule,
  IconService,
  InputModule,
  ModalModule,
  NotificationModule,
} from 'carbon-components-angular';
import { TEST_IDS } from '@valtimo/shared';

import {CARBON_CONSTANTS} from '../../../constants';
import {ValtimoCdsModalDirective} from '../../../directives/valtimo-cds-modal/valtimo-cds-modal.directive';
import {QuickSearchItem} from '../../../models';
import {QuickSearchStateService} from '../../../services';

@Component({
  selector: 'valtimo-quick-search-modal',
  templateUrl: './quick-search-modal.component.html',
  styleUrl: './quick-search-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ModalModule,
    ButtonModule,
    ValtimoCdsModalDirective,
    InputModule,
    NotificationModule,
    IconModule,
  ],
})
export class QuickSearchModalComponent {
  readonly TEST_IDS = TEST_IDS;

  @Input() public existingItems: QuickSearchItem[] = [];
  @Output() public readonly closeEvent = new EventEmitter<string | null>();

  public readonly $modalOpen = this.quickSearchStateService.$modalOpen;
  public readonly $showDuplicateError = signal<boolean>(false);
  public readonly formGroup = this.fb.group({
    title: this.fb.control('', [
      Validators.required,
      Validators.maxLength(50),
      this.uniqueTitleValidator(),
      this.noWhitespaceValidator(),
    ]),
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly iconService: IconService,
    private readonly quickSearchStateService: QuickSearchStateService
  ) {
    this.iconService.registerAll([WarningFilled16]);
  }

  public closeModal(save = false): void {
    this.closeEvent.emit(save ? this.formGroup.getRawValue().title : null);
    setTimeout(() => {
      this.formGroup.reset();
      this.$showDuplicateError.set(false);
    }, CARBON_CONSTANTS.modalAnimationMs);
  }

  private uniqueTitleValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value || !Array.isArray(this.existingItems)) return null;

      const value = control.value.trim().toLowerCase();
      const isDuplicate = this.existingItems
        .map((item: QuickSearchItem) => item.title)
        .some(item => item.trim().toLowerCase() === value);

      if (!isDuplicate) {
        this.$showDuplicateError.set(false);
        return null;
      }

      this.$showDuplicateError.set(true);
      return {titleExists: true};
    };
  }

  private noWhitespaceValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (typeof control.value !== 'string') return null;

      const isOnlyWhitespace = control.value.trim().length === 0;

      return isOnlyWhitespace ? {whitespace: true} : null;
    };
  }
}
