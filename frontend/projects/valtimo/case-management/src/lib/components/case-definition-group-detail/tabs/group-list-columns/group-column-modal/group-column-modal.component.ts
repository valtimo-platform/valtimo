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
import {GroupListColumn} from '@valtimo/document';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {
  ButtonModule,
  DropdownModule,
  InputModule,
  LayerModule,
  ModalModule,
  ToggleModule,
} from 'carbon-components-angular';
import {GlobalNotificationService} from '@valtimo/shared';
import {CaseDefinitionGroupManagementService} from '../../../../../services';

const DISPLAY_TYPES = ['text', 'date', 'datetime', 'boolean', 'enum', 'array'];
const DISPLAY_TYPE_ITEMS = DISPLAY_TYPES.map(t => ({content: t, value: t}));

@Component({
  standalone: true,
  selector: 'valtimo-group-column-modal',
  templateUrl: './group-column-modal.component.html',
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
    ToggleModule,
    ValtimoCdsModalDirective,
  ],
})
export class GroupColumnModalComponent implements OnChanges {
  @Input() public open = false;
  @Input() public groupKey: string | undefined;
  @Input() public column: GroupListColumn | null = null;
  @Output() public closeModal = new EventEmitter<boolean>();

  public readonly DISPLAY_TYPE_ITEMS = DISPLAY_TYPE_ITEMS;

  public formGroup: FormGroup = this.fb.group({
    key: ['', Validators.required],
    title: [''],
    displayType: ['text', Validators.required],
    sortable: [false],
    exportable: [true],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly groupService: CaseDefinitionGroupManagementService,
    private readonly translateService: TranslateService,
    private readonly notificationService: GlobalNotificationService
  ) {}

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['column'] || changes['open']) {
      if (this.open) {
        if (this.column) {
          this.formGroup.patchValue({
            key: this.column.key,
            title: this.column.title ?? '',
            displayType: this.column.displayType.type,
            sortable: this.column.sortable,
            exportable: this.column.exportable,
          });
          this.formGroup.get('key')?.disable();
        } else {
          this.formGroup.reset({
            key: '',
            title: '',
            displayType: 'text',
            sortable: false,
            exportable: true,
          });
          this.formGroup.get('key')?.enable();
        }
      }
    }
  }

  public onCloseModal(save = false): void {
    if (save && this.groupKey) {
      const value = this.formGroup.getRawValue();
      const displayTypeValue = value.displayType?.value ?? value.displayType;
      const request = {
        key: value.key,
        title: value.title || undefined,
        displayType: {type: displayTypeValue, displayTypeParameters: {}},
        sortable: value.sortable,
        exportable: value.exportable,
      };

      this.groupService.getListColumns(this.groupKey).subscribe(columns => {
        let updatedColumns;
        if (this.column) {
          updatedColumns = columns.map(c =>
            c.key === this.column!.key ? {...c, ...request} : c
          );
        } else {
          updatedColumns = [...columns, request];
        }

        this.groupService
          .updateListColumns(
            this.groupKey!,
            updatedColumns.map(c => ({
              key: c.key,
              title: c.title,
              displayType: c.displayType,
              sortable: c.sortable,
              exportable: c.exportable,
            }))
          )
          .subscribe({
            next: () => this.closeModal.emit(true),
            error: () => {
              this.notificationService.showToast({
                type: 'error',
                title: this.translateService.instant('caseManagement.groups.listColumns.saveError'),
              });
            },
          });
      });
    } else {
      this.closeModal.emit(false);
    }
  }
}
