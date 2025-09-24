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
import {Component, EventEmitter, Input, Output} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {CommonModule} from '@angular/common';
import {
  ButtonModule,
  IconModule,
  IconService,
  InputModule,
  LayerModule,
  ModalModule,
  TooltipModule,
} from 'carbon-components-angular';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Edit16 } from '@carbon/icons';
import { BasicCaseWidget, CaseWidget, CaseWidgetType } from '@valtimo/case';
import { ModalMode } from '@valtimo/shared';
import { AutoKeyInputComponent } from 'dist/valtimo/components';
import { CARBON_CONSTANTS, CarbonListItem } from '@valtimo/components';

@Component({
  selector: 'valtimo-case-management-divider-modal',
  templateUrl: './case-management-divider-modal.component.html',
  styleUrls: ['./case-management-divider-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ModalModule,
    ButtonModule,
    IconModule,
    InputModule,
    TooltipModule,
    ReactiveFormsModule,
    LayerModule,
    AutoKeyInputComponent
  ],
})
export class CaseManagementDividerModalComponent {
  private _modalMode: ModalMode;
  @Input()
  public set modalMode(value: ModalMode) {
    this._modalMode = value;
  }
  public get modalMode(): ModalMode {
    return this._modalMode;
  }

  private _open = false;
  @Input() public set open(value: boolean) {
    this._open = value;
  }

  public get open(): boolean {
    return this._open;
  }

  @Input() public widgets: CarbonListItem;
  @Input() public usedKeys: string[] = [];

  public dividerForm: FormGroup = this.fb.group({
    title: this.fb.control<string>(''),
    key: this.fb.control<string>('', [
      Validators.required,
      Validators.pattern('[A-Za-z0-9-]*'),
    ]),
  });

  @Input() public set prefillData(value: CaseWidget | null) {
    if (!value) return;

    this.dividerForm.patchValue({
      title: value.title || '',
      key: value.key || '',
    });
  }

  @Output() public closeEvent = new EventEmitter<BasicCaseWidget | null>();

  public get title(): AbstractControl<string> {
    return this.dividerForm.get('title') as AbstractControl<string>;
  }

  public get buttonLabel(): string {
    switch (this.modalMode) {
      case 'add':
        return 'widgetTabManagement.list.dividerModal.add';
      case 'edit':
        return 'widgetTabManagement.list.dividerModal.edit';
      case 'duplicate':
        return 'widgetTabManagement.list.dividerModal.duplicate';
      default:
        return 'widgetTabManagement.list.dividerModal.add';
    }
  }

  public divider: BasicCaseWidget = {
    type: CaseWidgetType.DIVIDER,
    title: '',
    width: 4,
    highContrast: false,
    key: '',
  };

  constructor(
    private readonly fb: FormBuilder,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Edit16]);
  }

  public onCloseModal(dividerCreated?: boolean): void {
    if (!dividerCreated) {
      this.closeEvent.emit(null);
      this.resetForm();
      return;
    }

    const { title, key } = this.dividerForm.controls;

    this.divider.title = title.value ?? '';
    this.divider.key = key.value ?? '';

    this.closeEvent.emit(this.divider);
    this.resetForm();
  }

  public onFocusOut(): void {
    const { title, key } = this.dividerForm.controls;

    if (!title || !key) {
      return;
    }
  }

  private resetForm(): void {
    setTimeout(() => {
      this.dividerForm.reset();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
}
