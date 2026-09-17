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
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {GroupSearchField} from '@valtimo/document';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {
  ButtonModule,
  DropdownModule,
  InputModule,
  LayerModule,
  ModalModule,
} from 'carbon-components-angular';
import {GlobalNotificationService} from '@valtimo/shared';
import {CaseDefinitionGroupManagementService} from '../../../../../services';

const DATA_TYPES = ['text', 'number', 'date', 'datetime', 'boolean'];
const FIELD_TYPES = ['single', 'range', 'multi-select-dropdown', 'single-select-dropdown'];
const MATCH_TYPES = ['exact', 'like'];

const DATA_TYPE_ITEMS = DATA_TYPES.map(t => ({content: t, value: t}));
const FIELD_TYPE_ITEMS = FIELD_TYPES.map(t => ({content: t, value: t}));
const MATCH_TYPE_ITEMS = MATCH_TYPES.map(t => ({content: t, value: t}));

@Component({
  standalone: true,
  selector: 'valtimo-group-search-field-modal',
  templateUrl: './group-search-field-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ButtonModule,
    DropdownModule,
    InputModule,
    LayerModule,
    ModalModule,
    ValtimoCdsModalDirective,
  ],
})
export class GroupSearchFieldModalComponent implements OnChanges {
  @Input() public open = false;
  @Input() public groupKey: string | undefined;
  @Input() public field: GroupSearchField | null = null;
  @Output() public closeModal = new EventEmitter<boolean>();

  public readonly DATA_TYPE_ITEMS = DATA_TYPE_ITEMS;
  public readonly FIELD_TYPE_ITEMS = FIELD_TYPE_ITEMS;
  public readonly MATCH_TYPE_ITEMS = MATCH_TYPE_ITEMS;

  public formGroup: FormGroup = this.fb.group({
    key: ['', Validators.required],
    title: [''],
    dataType: ['text', Validators.required],
    fieldType: ['single', Validators.required],
    matchType: ['exact'],
    dropdownDataProvider: [''],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly groupService: CaseDefinitionGroupManagementService,
    private readonly translateService: TranslateService,
    private readonly notificationService: GlobalNotificationService
  ) {}

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['field'] || changes['open']) {
      if (this.open) {
        if (this.field) {
          this.formGroup.patchValue({
            key: this.field.key,
            title: this.field.title ?? '',
            dataType: this.field.dataType,
            fieldType: this.field.fieldType,
            matchType: this.field.matchType ?? 'exact',
            dropdownDataProvider: this.field.dropdownDataProvider ?? '',
          });
          this.formGroup.get('key')?.disable();
        } else {
          this.formGroup.reset({
            key: '',
            title: '',
            dataType: 'text',
            fieldType: 'single',
            matchType: 'exact',
            dropdownDataProvider: '',
          });
          this.formGroup.get('key')?.enable();
        }
      }
    }
  }

  public onCloseModal(save = false): void {
    if (save && this.groupKey) {
      const value = this.formGroup.getRawValue();
      const request = {
        key: value.key,
        title: value.title || undefined,
        dataType: value.dataType,
        fieldType: value.fieldType,
        matchType: value.matchType || undefined,
        dropdownDataProvider: value.dropdownDataProvider || undefined,
      };

      this.groupService.getSearchFields(this.groupKey).subscribe(fields => {
        let updatedFields;
        if (this.field) {
          updatedFields = fields.map(f => (f.key === this.field!.key ? {...f, ...request} : f));
        } else {
          updatedFields = [...fields, request];
        }

        this.groupService
          .updateSearchFields(
            this.groupKey!,
            updatedFields.map(f => ({
              key: f.key,
              title: f.title,
              dataType: f.dataType,
              fieldType: f.fieldType,
              matchType: f.matchType,
              dropdownDataProvider: f.dropdownDataProvider,
            }))
          )
          .subscribe({
            next: () => this.closeModal.emit(true),
            error: () => {
              this.notificationService.showToast({
                type: 'error',
                title: this.translateService.instant('caseManagement.groups.searchFields.saveError'),
              });
            },
          });
      });
    } else {
      this.closeModal.emit(false);
    }
  }
}
