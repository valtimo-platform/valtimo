/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {AbstractControl, FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {
  ButtonModule,
  DropdownModule,
  InputModule,
  ListItem,
  ModalModule,
  RadioModule,
} from 'carbon-components-angular';
import {
  ConfiguredColumn,
  DocumentenApiColumnModalType,
  DocumentenApiColumnModalTypeCloseEvent,
} from '../../models';
import {DocumentenApiColumnService} from '../../services';

@Component({
  selector: 'valtimo-documenten-api-column-modal',
  templateUrl: './documenten-api-column-modal.component.html',
  styleUrls: ['./documenten-api-column-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ModalModule,
    TranslateModule,
    InputModule,
    ReactiveFormsModule,
    ButtonModule,
    DropdownModule,
    RadioModule,
  ],
})
export class DocumentenApiColumnModalComponent {
  @Input() definitionName: string;
  @Input() type: DocumentenApiColumnModalType;
  @Input() prefillColumn: ConfiguredColumn;

  private _availableColumns: ListItem[] = [];
  @Input() public set availableColumns(value: ConfiguredColumn[]) {
    this._availableColumns = value.map((column: ConfiguredColumn) => ({
      content: column.key,
      selected: false,
    }));
  }
  public get availableColumns(): ListItem[] {
    return this._availableColumns;
  }

  @Output() closeModal = new EventEmitter<DocumentenApiColumnModalTypeCloseEvent>();

  public formGroup = this.fb.group({
    column: this.fb.control({content: '', selected: false}, Validators.required),
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly zgwDocumentenApiColumnService: DocumentenApiColumnService
  ) {}

  public onClose(refresh = false): void {
    this.closeModal.emit(refresh ? 'closeAndRefresh' : 'close');
  }

  public addColumn(): void {
    const columnValue: ListItem | null | undefined = this.formGroup.get('column')?.value;
    if (!columnValue || !this.definitionName) {
      return;
    }

    this.zgwDocumentenApiColumnService
      .updateColumn(this.definitionName, {key: columnValue.content, enabled: true})
      .subscribe(() => {
        this.closeModal.emit('closeAndRefresh');
      });
  }

  public editColumn(): void {
    // TODO: implement when sorting is BE supported
  }
}
