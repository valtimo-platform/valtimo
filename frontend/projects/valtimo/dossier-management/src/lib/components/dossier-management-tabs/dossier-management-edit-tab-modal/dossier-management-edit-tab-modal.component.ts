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
import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {ApiTabItem} from '@valtimo/dossier';
import {TabService} from '../../../services';

@Component({
  selector: 'valtimo-dossier-management-edit-tab-modal',
  templateUrl: './dossier-management-edit-tab-modal.component.html',
})
export class DossierManagementEditTabModalComponent {
  @Input() open: boolean;

  private _tab: ApiTabItem;
  @Input() public set tab(value: ApiTabItem) {
    if (!value) {
      return;
    }

    if (!!this.tabService.configuredContentKeys) {
      this.configuredKeysForEdit = this.tabService.configuredContentKeys.filter(
        (tabKey: string) => tabKey !== value.contentKey
      );
    }

    this._tab = value;
    this.form = this.fb.group({
      name: this.fb.control(value.name),
      key: this.fb.control({value: value.key, disabled: true}, Validators.required),
      contentKey: this.fb.control(value.contentKey, Validators.required),
    });
  }
  public get tab(): ApiTabItem {
    return this._tab;
  }

  @Output() closeModalEvent = new EventEmitter<ApiTabItem | null>();

  public form: FormGroup;
  public configuredKeysForEdit: string[];

  constructor(
    private readonly fb: FormBuilder,
    private readonly tabService: TabService
  ) {}

  public onCloseModal(): void {
    this.closeModalEvent.emit(null);
  }

  public editTab(): void {
    const {contentKey, name} = this.form.getRawValue();

    if (!contentKey) {
      return;
    }

    this.closeModalEvent.emit({...this.tab, name, contentKey});
  }
}
