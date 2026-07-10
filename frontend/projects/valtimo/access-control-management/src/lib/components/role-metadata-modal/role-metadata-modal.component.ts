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

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import {FormBuilder, Validators} from '@angular/forms';
import {CARBON_CONSTANTS, SelectItem} from '@valtimo/components';
import {Role, RoleMetadataModal} from '../../models';
import {AccessControlService} from '../../services';

@Component({
  standalone: false,
  selector: 'valtimo-role-metadata-modal',
  templateUrl: './role-metadata-modal.component.html',
  styleUrls: ['./role-metadata-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleMetadataModalComponent implements OnInit {
  @Input() public type: RoleMetadataModal = 'add';
  @Input() public set open(value: boolean) {
    this._open = value;
    // Fetch the selectable roles the first time the modal is opened.
    if (value && !this._rolesRequested) this.loadRoleKeyItems();
  }
  public get open(): boolean {
    return this._open;
  }
  @Input() public set defaultKeyValue(value: string) {
    this._defaultKeyValue = value;
    this.setDefaultKeyValue(value);
  }
  // Role keys already configured; excluded from the picker so a role can't be added twice.
  @Input() public usedKeys: string[] | null = [];

  @Output() public closeEvent = new EventEmitter<Role | null>();

  // Selectable role keys, fetched from the identity provider (e.g. Keycloak realm roles). The picker
  // only lists these; a custom key is entered via manual mode.
  public readonly $roleKeyItems = signal<SelectItem[]>([]);
  public readonly $loadingRoles = signal<boolean>(false);
  // Whether the key is typed manually rather than picked from the dropdown.
  public readonly $keyManual = signal<boolean>(false);

  public form = this.fb.group({
    key: this.fb.control('', Validators.required),
  });

  private _open = false;
  private _defaultKeyValue!: string;
  private _rolesRequested = false;

  public get key() {
    return this.form.get('key')!;
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly accessControlService: AccessControlService
  ) {}

  public ngOnInit(): void {
    // Editing starts in manual mode so the existing key is shown for renaming; adding starts on the
    // role picker.
    this.$keyManual.set(this.type === 'edit');
  }

  public onCancel(): void {
    this.closeEvent.emit(null);
    this.resetForm();
  }

  public onConfirm(): void {
    if (this.form.invalid) {
      return;
    }

    this.closeEvent.emit({roleKey: this.key.value});
    this.resetForm();
  }

  // Switches between picking a role and typing one. Returning to the picker drops a value that isn't
  // one of the listed roles, so a valid option must be chosen.
  public onKeyManualToggle(manual: boolean): void {
    this.$keyManual.set(manual);
    if (!manual && !this.$roleKeyItems().some(item => item.id === this.key.value)) {
      this.key.setValue('');
    }
  }

  private loadRoleKeyItems(): void {
    this._rolesRequested = true;
    this.$loadingRoles.set(true);
    // Only application roles (ROLE_*) are offered; roles already configured are filtered out (except
    // when editing, where the current key must remain selectable).
    this.accessControlService.getExternalRoles('ROLE_').subscribe(roles => {
      const used = this.usedKeys ?? [];
      this.$roleKeyItems.set(
        roles
          .filter(role => this.type === 'edit' || !used.includes(role))
          .map(role => ({id: role, text: role}))
      );
      // With no roles to pick from, fall back to manual entry so the field stays usable.
      if (this.type === 'add' && this.$roleKeyItems().length === 0) this.$keyManual.set(true);
      this.$loadingRoles.set(false);
    });
  }

  private setDefaultKeyValue(value: string): void {
    this.key.setValue(value);
  }

  private resetForm(): void {
    setTimeout(() => {
      this.form.reset();
      this.$keyManual.set(this.type === 'edit');
      if (this.type === 'edit') {
        this.setDefaultKeyValue(this._defaultKeyValue);
      }
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
}
