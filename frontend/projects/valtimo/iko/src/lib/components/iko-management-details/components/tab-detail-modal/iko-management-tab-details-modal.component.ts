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
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {
  AutoKeyInputComponent,
  CarbonMultiInputModule,
  InputLabelModule,
  runAfterCarbonModalClosed,
  SelectItem,
  SelectModule,
  ValtimoCdsModalDirective,
  WIDGET_LAYOUT_TRANSLATION_KEYS,
  WIDGET_LAYOUT_VALUES,
  WidgetLayout,
  WidgetLayoutInfoComponent,
} from '@valtimo/components';
import {ModalCloseEvent, ModalMode} from '@valtimo/shared';
import {
  ButtonModule,
  InputModule,
  LayerModule,
  ModalModule,
  NumberModule,
  ToggleModule,
  TooltipModule,
} from 'carbon-components-angular';
import {filter, map, Observable, switchMap} from 'rxjs';
import {IkoTabType, PropertyField, TabDto} from '../../../../models';
import {IkoManagementApiService} from '../../../../services';
import {PropertiesFormComponent} from '../../../iko-management-properties/iko-management-properties.component';

@Component({
  selector: 'valtimo-iko-management-tab-details-modal',
  templateUrl: './iko-management-tab-details-modal.component.html',
  styleUrl: './iko-management-tab-details-modal.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ModalModule,
    ValtimoCdsModalDirective,
    ButtonModule,
    InputModule,
    ReactiveFormsModule,
    LayerModule,
    SelectModule,
    ToggleModule,
    TooltipModule,
    CarbonMultiInputModule,
    InputLabelModule,
    NumberModule,
    AutoKeyInputComponent,
    PropertiesFormComponent,
    WidgetLayoutInfoComponent,
  ],
})
export class IkoManagementTabDetailsModalComponent {
  public readonly $openModal = signal<boolean>(false);
  @Input() public set openModal(value: boolean) {
    this.$openModal.set(value);
  }

  @Input() public readonly usedKeys: string[] = [];

  public readonly $selectedKey = signal<string>('');
  @Input() public set selectedTab(value: TabDto) {
    if (!value) return;
    this.$selectedKey.set(value.key);
    this.form.setValue({
      key: value.key,
      title: value.title || '',
      type: value.type,
      properties: value.properties || {},
      widgetLayout: value.widgetLayout ?? WidgetLayout.MUURI_GAP_FREE,
    });
    this.form.markAsPristine();
  }

  private _modalMode: ModalMode = 'add';
  @Input()
  public set modalMode(value: ModalMode) {
    this._modalMode = value;
  }
  public get modalMode(): ModalMode {
    return this._modalMode;
  }

  @Output() public readonly closeModalEvent = new EventEmitter<ModalCloseEvent>();

  public readonly form = this.formBuilder.group({
    title: this.formBuilder.control('', Validators.required),
    key: this.formBuilder.control('', [Validators.required]),
    type: this.formBuilder.control('', [Validators.required]),
    properties: this.formBuilder.group({}),
    widgetLayout: this.formBuilder.control<WidgetLayout>(WidgetLayout.MUURI_GAP_FREE),
  });

  public get title(): AbstractControl<string> {
    return this.form.get('title') as AbstractControl<string>;
  }
  public get key(): AbstractControl<string> {
    return this.form.get('key') as AbstractControl<string>;
  }
  public get type(): AbstractControl<string> {
    return this.form.get('type') as AbstractControl<string>;
  }
  public get properties(): FormGroup | null {
    return this.form.get('properties') as FormGroup | null;
  }

  private readonly _ikoViewKey$: Observable<string> = this.route.params.pipe(
    map(params => params?.key),
    filter(key => !!key)
  );

  private readonly _TAB_TYPES: Array<IkoTabType> = [IkoTabType.WIDGETS];

  public readonly tabTypeSelectItems: SelectItem[] = this._TAB_TYPES.map(tabType => ({
    id: tabType,
    translationKey: `ikoManagement.tabTypes.${tabType}`,
  }));

  public readonly widgetLayoutSelectItems: SelectItem[] = WIDGET_LAYOUT_VALUES.map(value => ({
    id: value,
    translationKey: WIDGET_LAYOUT_TRANSLATION_KEYS[value],
  }));

  public readonly propertyFields$: Observable<PropertyField[]> =
    this.ikoManagementApiService.getIkoTabPropertyFields('iko');

  constructor(
    private readonly ikoManagementApiService: IkoManagementApiService,
    private readonly formBuilder: FormBuilder,
    private readonly route: ActivatedRoute
  ) {}

  public closeModal(): void {
    this.closeModalEvent.emit('close');
    runAfterCarbonModalClosed(this.resetForm);
  }

  public addTab(): void {
    const formValue = this.form.getRawValue();

    this.disableForm();

    this._ikoViewKey$
      .pipe(
        switchMap(ikoViewKey =>
          this.modalMode === 'add'
            ? this.ikoManagementApiService.createIkoTab(ikoViewKey, formValue.key, formValue)
            : this.ikoManagementApiService.updateIkoTab(ikoViewKey, formValue.key, formValue)
        )
      )
      .subscribe({
        next: () => {
          this.enableForm();
          this.closeModalEvent.emit('closeAndRefresh');
          runAfterCarbonModalClosed(this.resetForm);
        },
        error: () => {
          this.enableForm();
        },
      });
  }

  private disableForm(): void {
    this.form.disable();
  }

  private enableForm(): void {
    this.form.enable();
  }

  private resetForm = (): void => {
    this.form.reset();
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.form.updateValueAndValidity();
  };
}
