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
  computed,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import {Edit16, Save16} from '@carbon/icons';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {EditorModel} from '../../models';
import {EditorModule} from '../editor/editor.module';
import {TranslateModule} from '@ngx-translate/core';
import {ConfirmationModalModule} from '../confirmation-modal/confirmation-modal.module';
import {BehaviorSubject} from 'rxjs';

@Component({
  selector: 'valtimo-json-editor',
  templateUrl: './json-editor.component.html',
  styleUrl: './json-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    EditorModule,
    ButtonModule,
    IconModule,
    TranslateModule,
    ConfirmationModalModule,
  ],
})
export class JsonEditorComponent {
  private readonly _disabled = signal<boolean>(false);
  @Input() public set disabled(value: boolean) {
    this._disabled.set(value);
  }

  private _initialModel: EditorModel;
  @Input() public set model(value: EditorModel) {
    this._initialModel = value;
  }
  public get model(): EditorModel {
    return this._initialModel;
  }
  @Input() editorOptions;
  @Input() fitPage = false;
  @Input() fitPageExtraSpace = 0;
  @Input() formatOnLoad = true;
  @Input() heightPx!: number;
  @Input() heightStyle!: string;
  @Input() jsonSchema?: string;
  @Input() showEditButton = true;
  @Input() widthPx!: number;

  @Output() public readonly changeEvent = new EventEmitter();
  @Output() public readonly discardEvent = new EventEmitter();
  @Output() public readonly keepEditingEvent = new EventEmitter();
  @Output() public readonly saveEvent = new EventEmitter<object>();

  public readonly isEditActive = signal<boolean>(false);
  public readonly isDisabled = computed(() => !this.isEditActive() || this._disabled());
  public readonly isValidJson = signal<boolean>(false);
  public readonly showSaveConfirmationModal$ = new BehaviorSubject<boolean>(false);
  public readonly showCancelConfirmationModal$ = new BehaviorSubject<boolean>(false);

  private _changesToSave: string | null = null;

  constructor(private readonly iconService: IconService) {
    this.iconService.registerAll([Edit16, Save16]);
  }

  public onCancelClick(): void {
    if (!this._changesToSave) {
      this.resetEditor();
      return;
    }

    this.showCancelConfirmationModal$.next(true);
  }

  public onEditClick(): void {
    this.isEditActive.set(true);
  }

  public onDiscardChanges(): void {
    this.discardEvent.emit();
    this.resetEditor();
    this.model = {...this._initialModel};
  }

  public onKeepEditingDefinition(): void {
    this.keepEditingEvent.emit();
  }

  public onSaveChanges(): void {
    if (!!this._changesToSave) this.saveEvent.emit(JSON.parse(this._changesToSave));

    this.resetEditor();
  }

  public onSaveClick(): void {
    this.showSaveConfirmationModal$.next(true);
  }

  public onValidEvent(isValid: boolean): void {
    this.isValidJson.set(isValid);
  }

  public onValueChangeEvent(value: string): void {
    if (!this.isValidJson()) return;

    this._changesToSave = value;
    this.changeEvent.emit();
  }

  private resetEditor(): void {
    this._changesToSave = null;
    this.isEditActive.set(false);
  }
}
