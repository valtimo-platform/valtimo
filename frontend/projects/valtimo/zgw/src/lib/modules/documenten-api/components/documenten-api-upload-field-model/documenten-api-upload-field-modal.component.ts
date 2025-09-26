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
  OnDestroy,
  Output,
} from '@angular/core';
import {
  CONFIDENTIALITY_LEVELS,
  DocumentenApiColumnModalTypeCloseEvent,
  LANGUAGE_ITEMS,
  STATUS_ITEMS,
} from '../../models';
import {BehaviorSubject, combineLatest, map, Observable, of, Subscription, switchMap} from 'rxjs';
import {CARBON_CONSTANTS} from '@valtimo/components';
import {AbstractControl, FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {
  ButtonModule,
  CheckboxModule,
  ComboBoxModule,
  InputModule,
  LayerModule,
  ListItem,
  ModalModule,
  ToggleModule,
} from 'carbon-components-angular';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {CommonModule} from '@angular/common';
import {DocumentenApiDocumentService} from '../../services';
import {DocumentenApiUploadField} from '../../models/documenten-api-upload-field.model';
import {DocumentService} from '@valtimo/document';

@Component({
  selector: 'valtimo-documenten-api-upload-field-modal',
  styleUrl: './documenten-api-upload-field-modal.component.scss',
  templateUrl: './documenten-api-upload-field-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ModalModule,
    TranslateModule,
    InputModule,
    ReactiveFormsModule,
    ButtonModule,
    ToggleModule,
    CheckboxModule,
    ComboBoxModule,
    LayerModule,
  ],
})
export class DocumentenApiUploadFieldModalComponent implements OnDestroy {
  @Input() public caseDefinitionKey!: string;
  @Input() public type!: string;
  protected key: string;

  @Input() public set prefill(field: DocumentenApiUploadField) {
    if (field) {
      this.key = field.key;
      this.defaultValue.setValue(field.defaultValue);
      this.visible.setValue(field.visible);
      this.readonly.setValue(field.readonly);
    }
  }

  @Output() public closeModalEvent = new EventEmitter<DocumentenApiColumnModalTypeCloseEvent>();

  public readonly formGroup = this.fb.group({
    defaultValue: this.fb.control('', [Validators.maxLength(256)]),
    selectedDefaultValue: this.fb.control(null),
    visible: this.fb.control(true, [Validators.required]),
    readonly: this.fb.control(false, [Validators.required]),
  });

  public readonly disabled$ = new BehaviorSubject<boolean>(false);

  public readonly confidentialityLevelItems$: Observable<Array<ListItem>> = combineLatest([
    this.defaultValue.valueChanges,
    this.translateService.stream('key'),
  ]).pipe(
    map(([selectedItem]) =>
      CONFIDENTIALITY_LEVELS.map(item => ({
        id: item,
        content: this.translateService.instant(`document.${item}`),
        selected: selectedItem === item,
      }))
    )
  );
  public readonly languageItems$: Observable<Array<ListItem>> = combineLatest([
    this.defaultValue.valueChanges,
    this.translateService.stream('key'),
  ]).pipe(
    map(([selectedItem]) =>
      LANGUAGE_ITEMS.map(item => ({
        id: item,
        content: this.translateService.instant(`document.${item}`),
        selected: selectedItem === item,
      }))
    )
  );
  public readonly statusItems$: Observable<Array<ListItem>> = combineLatest([
    this.defaultValue.valueChanges,
    this.translateService.stream('key'),
  ]).pipe(
    map(([selectedItem]) =>
      STATUS_ITEMS.map(item => ({
        id: item,
        content: this.translateService.instant(`document.${item}`),
        selected: selectedItem === item,
      }))
    )
  );
  public readonly documentTypeItems$: Observable<Array<ListItem>> = combineLatest([
    this.defaultValue.valueChanges,
    this.translateService.stream('key'),
  ]).pipe(
    switchMap(([selectedItem]) =>
      combineLatest([
        this.documentService.getDocumentTypes(this.caseDefinitionKey),
        of(selectedItem),
      ])
    ),
    map(([documentTypes, selectedItem]) =>
      documentTypes.map(item => ({
        id: item.url,
        content: item.name,
        selected: selectedItem === item.url,
      }))
    )
  );

  public get defaultValue(): AbstractControl<string> {
    return this.formGroup?.get('defaultValue');
  }

  public get selectedDefaultValue(): AbstractControl<ListItem> {
    return this.formGroup?.get('selectedDefaultValue');
  }

  public get visible(): AbstractControl<boolean> {
    return this.formGroup?.get('visible');
  }

  public get readonly(): AbstractControl<boolean> {
    return this.formGroup?.get('readonly');
  }

  public get invalid(): boolean {
    return !!this.formGroup?.invalid;
  }

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly documentenApiDocumentService: DocumentenApiDocumentService,
    private readonly translateService: TranslateService,
    private readonly documentService: DocumentService
  ) {}

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onClose(): void {
    this.close();
  }

  public clear(): void {
    this.selectedDefaultValue.setValue(null);
    this.defaultValue.setValue(null);
  }

  public saveUploadField(): void {
    this.disable();

    const formField = {
      key: this.key,
      defaultValue: this.selectedDefaultValue?.value?.id || this.defaultValue.value,
      visible: this.visible.value,
      readonly: this.readonly.value,
    } as DocumentenApiUploadField;

    this.documentenApiDocumentService
      .updateUploadField(this.caseDefinitionKey, formField)
      .subscribe({
        next: () => {
          this.enable();
          this.closeAndRefresh();
          this.resetForm();
        },
        error: () => {
          this.enable(false);
        },
      });
  }

  private resetForm(): void {
    this.formGroup.reset();
  }

  private disable(): void {
    this.disabled$.next(true);
    this.formGroup.disable();
  }

  private enable(delay = true): void {
    setTimeout(
      () => {
        this.disabled$.next(false);
        this.formGroup.enable();
      },
      delay ? CARBON_CONSTANTS.modalAnimationMs : 0
    );
  }

  private close(): void {
    this.closeModalEvent.emit('close');
    this.resetForm();
  }

  private closeAndRefresh(): void {
    this.closeModalEvent.emit('closeAndRefresh');
    this.resetForm();
  }
}
