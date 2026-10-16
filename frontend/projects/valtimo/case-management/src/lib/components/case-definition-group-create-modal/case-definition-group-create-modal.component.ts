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

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {ButtonModule, InputModule, ModalModule, LayerModule} from 'carbon-components-angular';
import {ValtimoCdsModalDirective, CARBON_CONSTANTS} from '@valtimo/components';
import {CaseDefinitionGroupManagementService} from '../../services';
import {CaseDefinitionGroupFormValue, CaseDefinitionGroupResponse} from '../../models';
import {CASE_DEFINITION_GROUP_MODAL_TEST_IDS} from '../../constants';

@Component({
  standalone: true,
  selector: 'valtimo-case-definition-group-create-modal',
  templateUrl: './case-definition-group-create-modal.component.html',
  styleUrls: ['./case-definition-group-create-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ButtonModule,
    InputModule,
    ModalModule,
    LayerModule,
    ValtimoCdsModalDirective,
  ],
})
export class CaseDefinitionGroupCreateModalComponent implements OnChanges {
  @Input() open = false;
  @Input() group: Pick<CaseDefinitionGroupResponse, 'title' | 'description'> | null = null;
  @Output() closeEvent = new EventEmitter<boolean>();
  @Output() saveEvent = new EventEmitter<CaseDefinitionGroupFormValue>();

  protected readonly testIds = CASE_DEFINITION_GROUP_MODAL_TEST_IDS;
  protected readonly titleMaxLength = 255;
  protected readonly descriptionMaxLength = 256;

  public formGroup: FormGroup = this.fb.group({
    title: this.fb.control('', [Validators.required, Validators.maxLength(this.titleMaxLength)]),
    description: this.fb.control('', Validators.maxLength(this.descriptionMaxLength)),
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly groupService: CaseDefinitionGroupManagementService
  ) {}

  public get isEditMode(): boolean {
    return !!this.group;
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue && this.group) {
      this.formGroup.reset({
        title: this.group.title,
        description: this.group.description ?? '',
      });
    }
  }

  public onCloseModal(confirmed?: boolean): void {
    if (!confirmed) {
      this.closeEvent.emit(false);
      this._resetForm();
      return;
    }

    const {title, description} = this.formGroup.controls;

    if (this.isEditMode) {
      this.saveEvent.emit({
        title: title.value,
        description: description.value || undefined,
      });
      this.closeEvent.emit(true);
      return;
    }

    this.groupService
      .createGroup({
        title: title.value,
        description: description.value || undefined,
      })
      .subscribe({
        next: () => {
          this.closeEvent.emit(true);
          this._resetForm();
        },
        error: () => {
          this.closeEvent.emit(false);
          this._resetForm();
        },
      });
  }

  private _resetForm(): void {
    setTimeout(() => {
      if (this.isEditMode) return;
      this.formGroup.reset();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
}
