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
  OnInit,
  Output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {InformationFilled16, TrashCan16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  CARBON_CONSTANTS,
  ColumnConfig,
  InputLabelModule,
  ValtimoCdsModalDirective,
  ValuePathSelectorPrefix,
  ViewType,
} from '@valtimo/components';
import {
  ButtonModule,
  DropdownModule,
  IconService,
  InputModule,
  LayerModule,
  ListItem,
  ModalModule,
} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  map,
  Observable,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import {
  IkoSearchField,
  SearchDropdownDataProvider,
  SearchDropdownValue,
  SearchField,
  SearchFieldDataType,
  SearchFieldFieldType,
  SearchFieldMatchType,
} from '../../../../../models';

@Component({
  selector: 'valtimo-iko-management-search-field-modal',
  templateUrl: './search-field-modal.component.html',
  styleUrl: './search-field-modal.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule,
    CommonModule,
    DropdownModule,
    InputLabelModule,
    InputModule,
    LayerModule,
    ModalModule,
    ReactiveFormsModule,
    TranslateModule,
    ValtimoCdsModalDirective,
  ],
})
export class IkoManagementSearchFieldModalComponent implements OnInit {
  @Input({required: true}) open: boolean;

  private _prefillData: IkoSearchField | null;
  @Input() public set prefillData(value: IkoSearchField | null) {
    this._prefillData = value;
    this.setPrefilledForm(value);
  }
  public get prefillData(): IkoSearchField | null {
    return this._prefillData;
  }
  @Output() closeEvent = new EventEmitter<Partial<IkoSearchField> | null>();

  public readonly formGroup = this.fb.group({
    key: this.fb.control<string>('', Validators.required),
    title: this.fb.control<string>('', Validators.required),
    path: this.fb.control<string>('', Validators.required),
    dataType: this.fb.control<ListItem | null>(null, Validators.required),
    matchType: this.fb.control<ListItem | null>(null, this.matchTypeValidator),
    fieldType: this.fb.control<ListItem | null>(null, Validators.required),
    dropdownDataProvider: this.fb.control<ListItem | null>(null),
    dropdownValues: this.fb.array<{key: string; value: string}>([]),
  });

  public get dataType(): AbstractControl<ListItem | null> | null {
    return this.formGroup.get('dataType');
  }
  public get dataTypeValue$(): Observable<ListItem | null> {
    return this.dataType?.valueChanges.pipe(startWith(this.dataType.value)) ?? of(null);
  }

  public get matchType(): AbstractControl<ListItem | null> | null {
    return this.formGroup.get('matchType');
  }
  public get matchTypeValue$(): Observable<ListItem | null> {
    return this.matchType?.valueChanges.pipe(startWith(this.matchType.value)) ?? of(null);
  }

  public get dropdownDataProvider(): AbstractControl<ListItem | null> | null {
    return this.formGroup.get('dropdownDataProvider');
  }

  public get dropdownDataProviderValue$(): Observable<ListItem | null> {
    return (
      this.dropdownDataProvider?.valueChanges.pipe(startWith(this.dropdownDataProvider.value)) ??
      of(null)
    );
  }

  public get fieldType(): AbstractControl<ListItem | null> | null {
    return this.formGroup.get('fieldType');
  }
  public get fieldTypeValue$(): Observable<ListItem | null> {
    return this.fieldType?.valueChanges.pipe(startWith(this.fieldType.value)) ?? of(null);
  }

  public readonly SearchFieldDataType = SearchFieldDataType;
  public readonly SearchFieldFieldType = SearchFieldFieldType;
  public readonly SearchDropdownDataProvider = SearchDropdownDataProvider;

  public get keyValue(): string | null {
    const controlValue = this.formGroup.get('key')?.value;

    return !controlValue ? null : controlValue;
  }

  public get dataTypeValue(): string | null {
    const controlValue = this.formGroup.get('dataType')?.value;
    this._dataTypeValue$.next(controlValue?.id);

    return !controlValue ? null : controlValue.id;
  }

  public get fieldTypeValue(): string | null {
    const controlValue = this.formGroup.get('fieldType')?.value;

    return !controlValue ? null : controlValue.id;
  }

  public get dropdownDataProviderValue(): string | null {
    const controlValue = this.formGroup.get('dropdownDataProvider')?.value;
    this._dropdownProviderValue$.next(controlValue?.id);

    return !controlValue ? null : controlValue.id;
  }

  public get dropdownValuesArray(): FormArray | null {
    const formArray = this.formGroup.get('dropdownValues');

    return !formArray ? null : (formArray as FormArray);
  }

  public readonly DROPDOWN_FIELDS: ColumnConfig[] = [
    {
      key: 'key',
      label: 'searchFieldsOverview.key',
      viewType: ViewType.TEXT,
    },
    {
      key: 'value',
      label: 'searchFieldsOverview.text',
      viewType: ViewType.TEXT,
    },
  ];

  private readonly _dataTypeValue$ = new BehaviorSubject<SearchFieldDataType | null | undefined>(
    null
  );

  private readonly _dropdownProviderValue$ = new BehaviorSubject<
    SearchDropdownDataProvider | null | undefined
  >(null);

  public readonly dataTypeItems$: Observable<ListItem[]> = combineLatest([
    this.dataTypeValue$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([dataTypeValue]) =>
      [
        {
          content: this.translateService.instant('searchFields.text'),
          id: SearchFieldDataType.TEXT,
        },
        {
          content: this.translateService.instant('searchFields.boolean'),
          id: SearchFieldDataType.BOOLEAN,
        },
        {
          content: this.translateService.instant('searchFields.date'),
          id: SearchFieldDataType.DATE,
        },
        {
          content: this.translateService.instant('searchFields.datetime'),
          id: SearchFieldDataType.DATETIME,
        },
        {
          content: this.translateService.instant('searchFields.number'),
          id: SearchFieldDataType.NUMBER,
        },
        {
          content: this.translateService.instant('searchFields.time'),
          id: SearchFieldDataType.TIME,
        },
      ].map(item => ({...item, selected: item.id === dataTypeValue?.id}))
    )
  );

  public readonly fieldTypeItems$: Observable<ListItem[]> = combineLatest([
    this._dataTypeValue$.pipe(distinctUntilChanged()),
    this.fieldTypeValue$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([dataTypeValue, fieldTypeValue]) =>
      [
        {
          content: this.translateService.instant('searchFieldsOverview.single'),
          id: SearchFieldFieldType.SINGLE,
        },
        {
          content: this.translateService.instant('searchFieldsOverview.range'),
          id: SearchFieldFieldType.RANGE,
        },
        ...(dataTypeValue === SearchFieldDataType.TEXT
          ? [
              {
                content: this.translateService.instant(
                  'searchFieldsOverview.single-select-dropdown'
                ),
                id: SearchFieldFieldType.SINGLE_SELECT_DROPDOWN,
              },
              {
                content: this.translateService.instant(
                  'searchFieldsOverview.multi-select-dropdown'
                ),
                id: SearchFieldFieldType.MULTI_SELECT_DROPDOWN,
              },
            ]
          : []),
      ].map(item => ({...item, selected: item.id === fieldTypeValue?.id}))
    )
  );

  public readonly dataProviderItems$: Observable<ListItem[]> = this.translateService
    .stream('key')
    .pipe(
      switchMap(() => this.dropdownDataProviderValue$),
      map(dataProviderValue =>
        [
          {
            content: this.translateService.instant(
              'searchFieldsOverview.dropdownDatabaseDataProvider'
            ),
            id: SearchDropdownDataProvider.DATABASE,
          },
          {
            content: this.translateService.instant(
              'searchFieldsOverview.dropdownJsonFileDataProvider'
            ),
            id: SearchDropdownDataProvider.JSON,
          },
        ].map(item => ({...item, selected: item.id === dataProviderValue?.id}))
      )
    );

  public readonly matchTypeItems$: Observable<ListItem[]> = this.translateService
    .stream('key')
    .pipe(
      switchMap(() => this.matchTypeValue$),
      map(matchTypeValue =>
        [
          {
            content: this.translateService.instant('searchFieldsOverview.like'),
            id: SearchFieldMatchType.LIKE,
          },
          {
            content: this.translateService.instant('searchFieldsOverview.exact'),
            id: SearchFieldMatchType.EXACT,
          },
        ].map(item => ({...item, selected: item.id === matchTypeValue?.id}))
      )
    );

  public readonly ValuePathSelectorPrefix = ValuePathSelectorPrefix;

  constructor(
    private readonly iconService: IconService,
    private readonly fb: FormBuilder,
    private readonly translateService: TranslateService
  ) {
    this.iconService.registerAll([TrashCan16, InformationFilled16]);
  }

  public ngOnInit(): void {
    this.formGroup.setValidators([
      this.dropdownDataProviderValidator,
      this.dropdownValuesValidator,
    ]);
  }

  public addDropdownValue(prefillValue?: {key: string; value: string}): void {
    if (!this.dropdownValuesArray) return;

    this.dropdownValuesArray.push(
      this.fb.group({
        key: this.fb.control(prefillValue?.key ?? '', Validators.required),
        value: this.fb.control(prefillValue?.value ?? '', Validators.required),
      })
    );
  }

  public removeDropdownValue(index: number): void {
    if (!this.dropdownValuesArray) return;

    this.dropdownValuesArray.removeAt(index);
  }

  public onCancel(): void {
    this.closeEvent.emit(null);
    this.resetForm();
  }

  public onSave(): void {
    const groupValue = this.formGroup.getRawValue();
    this.closeEvent.emit({
      ...(groupValue.title && {title: groupValue.title}),
      ...(groupValue.key && {key: groupValue.key}),
      ...(groupValue.path && {path: groupValue.path}),
      ...(groupValue.dataType?.content && {dataType: groupValue.dataType.id}),
      ...(groupValue.matchType?.content && {matchType: groupValue.matchType.id}),
      ...(groupValue.fieldType?.content && {fieldType: groupValue.fieldType.id}),
      ...(groupValue.dropdownDataProvider?.content && {
        dropdownDataProvider: groupValue.dropdownDataProvider.id,
      }),
      ...(groupValue.dropdownValues && {
        dropdownValues: groupValue.dropdownValues.reduce(
          (acc, curr) => ({...acc, ...(!!curr?.key && {[curr.key]: curr.value})}),
          {}
        ),
      }),
    });

    this.resetForm();
  }

  private setPrefilledForm(prefillData: IkoSearchField | null): void {
    if (!prefillData) return;

    this.formGroup.patchValue({
      ...prefillData,
      dataType: !prefillData.dataType
        ? null
        : {
            content: prefillData.dataType,
            id: prefillData.dataType,
            selected: true,
          },
      matchType: !prefillData.matchType
        ? null
        : {
            content: prefillData.matchType,
            id: prefillData.matchType,
            selected: true,
          },
      fieldType: !prefillData.fieldType
        ? null
        : {
            content: prefillData.fieldType,
            id: prefillData.fieldType,
            selected: true,
          },
      dropdownDataProvider: !prefillData.dropdownDataProvider
        ? null
        : {
            content: prefillData.dropdownDataProvider,
            id: prefillData.dropdownDataProvider,
            selected: true,
          },
      dropdownValues: [],
    });

    if (prefillData.dropdownDataProvider && prefillData.dropdownValues)
      this.setPrefilledDropdownValues(prefillData.dropdownValues);
    this.formGroup.get('key')?.disable();
  }

  private setPrefilledDropdownValues(dropdownValue: SearchDropdownValue): void {
    if (!this.dropdownValuesArray || !this.dropdownDataProviderValue) return;

    Object.entries(dropdownValue).forEach(([key, value]) => {
      this.addDropdownValue({key, value});
    });
  }

  private matchTypeValidator(control: AbstractControl): null | {[key: string]: string} {
    const controlValue: ListItem | undefined = control.value;
    const dataTypeControlValue: ListItem | null | undefined =
      control.parent?.get('dataType')?.value;

    if (
      dataTypeControlValue?.id === SearchFieldDataType.TEXT &&
      (!controlValue || !controlValue.selected)
    )
      return {error: 'Match type not selected'};

    return null;
  }

  private dropdownDataProviderValidator(group: typeof this.formGroup): ValidationErrors | null {
    const controlValue: ListItem | undefined | null = group.get('dropdownDataProvider')?.value;
    const fieldTypeControlValue: ListItem | null | undefined = group.get('fieldType')?.value;

    if (
      [
        SearchFieldFieldType.SINGLE_SELECT_DROPDOWN,
        SearchFieldFieldType.MULTI_SELECT_DROPDOWN,
      ].includes(fieldTypeControlValue?.id) &&
      !controlValue
    )
      return {error: 'Dropdown source provider is not specified'};

    return null;
  }

  private dropdownValuesValidator(group: typeof this.formGroup): ValidationErrors | null {
    const controlValue: ({key: string; value: string} | null)[] | undefined =
      group.get('dropdownValues')?.value;
    const fieldTypeControlValue = group.get('fieldType')?.value?.id;
    const dropdownProviderValue = group.get('dropdownDataProvider')?.value?.id;

    if (
      [
        SearchFieldFieldType.SINGLE_SELECT_DROPDOWN,
        SearchFieldFieldType.MULTI_SELECT_DROPDOWN,
      ].includes(fieldTypeControlValue) &&
      (!controlValue || controlValue?.length === 0) &&
      dropdownProviderValue === SearchDropdownDataProvider.DATABASE
    )
      return {error: 'Dropdown source provider is not specified or is empty'};

    return null;
  }

  private resetForm(): void {
    setTimeout(() => {
      while (!!this.dropdownValuesArray?.length) {
        this.dropdownValuesArray.removeAt(0);
      }
      this.formGroup.reset();
      this.formGroup.enable();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
}
