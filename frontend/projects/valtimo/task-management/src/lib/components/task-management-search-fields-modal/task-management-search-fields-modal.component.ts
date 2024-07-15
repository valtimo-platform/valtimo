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
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {InformationFilled16, TrashCan16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  CARBON_CONSTANTS,
  CarbonListModule,
  ColumnConfig,
  TooltipModule as VTooltipModule,
  ViewType,
} from '@valtimo/components';
import {DocumentService} from '@valtimo/document';
import {
  TaskListSearchDropdownDataProvider,
  TaskListSearchDropdownValue,
  TaskListSearchField,
  TaskListSearchFieldDataType,
  TaskListSearchFieldFieldType,
  TaskListSearchFieldMatchType,
} from '@valtimo/task';
import {
  ButtonModule,
  DropdownModule,
  IconModule,
  IconService,
  InputModule,
  ListItem,
  ModalModule,
} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  switchMap,
} from 'rxjs';

@Component({
  selector: 'valtimo-task-management-search-fields-modal',
  templateUrl: './task-management-search-fields-modal.component.html',
  styleUrl: './task-management-search-fields-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    DropdownModule,
    InputModule,
    ModalModule,
    ReactiveFormsModule,
    IconModule,
    CarbonListModule,
    VTooltipModule,
  ],
})
export class TaskManagementSearchFieldsModalComponent {
  @Input({required: true}) open: boolean;
  @Input({required: true}) documentDefinitionName: string;

  private _prefillData: TaskListSearchField | null;
  @Input() public set prefillData(value: TaskListSearchField | null) {
    this._prefillData = value;
    this.setPrefilledForm(value);
    this.setPrefilledDropdowns(value);
  }
  public get prefillData(): TaskListSearchField | null {
    return this._prefillData;
  }
  @Output() closeEvent = new EventEmitter<Partial<TaskListSearchField> | null>();

  public readonly form = this.fb.group({
    key: this.fb.control<string>('', Validators.required),
    title: this.fb.control<string>('', Validators.required),
    path: this.fb.control<string>('', Validators.required),
    dataType: this.fb.control<ListItem | null>(null, Validators.required),
    matchType: this.fb.control<ListItem | null>(null, this.matchTypeValidator),
    fieldType: this.fb.control<ListItem | null>(null, Validators.required),
    dropdownDataProvider: this.fb.control<ListItem | null>(
      null,
      this.dropdownDataProviderValidator
    ),
    dropdownValues: this.fb.array<{key: string; value: string}>([], this.dropdownValuesValidator),
  });

  public readonly TaskListSearchFieldDataType = TaskListSearchFieldDataType;
  public readonly TaskListSearchFieldFieldType = TaskListSearchFieldFieldType;
  public readonly TaskListSearchDropdownDataProvider = TaskListSearchDropdownDataProvider;

  public get keyValue(): string | null {
    const controlValue = this.form.get('key')?.value;

    return !controlValue ? null : controlValue;
  }

  public get dataTypeValue(): string | null {
    const controlValue = this.form.get('dataType')?.value;
    this._dataTypeValue$.next(controlValue?.id);

    return !controlValue ? null : controlValue.id;
  }

  public get fieldTypeValue(): string | null {
    const controlValue = this.form.get('fieldType')?.value;

    return !controlValue ? null : controlValue.id;
  }

  public get dropdownDataProviderValue(): string | null {
    const controlValue = this.form.get('dropdownDataProvider')?.value;
    this._dropdownProviderValue$.next(controlValue?.id);

    return !controlValue ? null : controlValue.id;
  }

  public get dropdownValuesArray(): FormArray | null {
    const formArray = this.form.get('dropdownValues');

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

  private readonly _dataTypeValue$ = new BehaviorSubject<
    TaskListSearchFieldDataType | null | undefined
  >(null);

  private readonly _dropdownProviderValue$ = new BehaviorSubject<
    TaskListSearchDropdownDataProvider | null | undefined
  >(null);
  public readonly dropdownReadonlyItems$ = this._dropdownProviderValue$.pipe(
    distinctUntilChanged(),
    filter(val => !!val && val === TaskListSearchDropdownDataProvider.JSON),
    switchMap((provider: TaskListSearchDropdownDataProvider | null | undefined) =>
      this.documentService.getDropdownData(
        provider ?? '',
        this.documentDefinitionName ?? '',
        this.keyValue ?? ''
      )
    ),
    map(dropdownData =>
      dropdownData ? Object.entries(dropdownData).map(([key, value]) => ({key, value})) : []
    )
  );

  private readonly _prefilledDataTypeItemId$ = new BehaviorSubject<string | null>(null);
  private readonly _dataTypeItems$: Observable<ListItem[]> = this.translateService
    .stream('key')
    .pipe(
      map(() => [
        {
          content: this.translateService.instant('searchFields.text'),
          id: TaskListSearchFieldDataType.TEXT,
          selected: false,
        },
        {
          content: this.translateService.instant('searchFields.boolean'),
          id: TaskListSearchFieldDataType.BOOLEAN,
          selected: false,
        },
        {
          content: this.translateService.instant('searchFields.date'),
          id: TaskListSearchFieldDataType.DATE,
          selected: false,
        },
        {
          content: this.translateService.instant('searchFields.datetime'),
          id: TaskListSearchFieldDataType.DATETIME,
          selected: false,
        },
        {
          content: this.translateService.instant('searchFields.number'),
          id: TaskListSearchFieldDataType.NUMBER,
          selected: false,
        },
        {
          content: this.translateService.instant('searchFields.time'),
          id: TaskListSearchFieldDataType.TIME,
          selected: false,
        },
      ])
    );
  public dataTypeItems$: Observable<ListItem[]> = combineLatest([
    this._dataTypeItems$,
    this._prefilledDataTypeItemId$,
  ]).pipe(
    filter(([dataTypeItems]) => !!dataTypeItems),
    map(([dataTypeItems, itemId]) =>
      !itemId
        ? dataTypeItems
        : dataTypeItems.map((typeItem: ListItem) =>
            typeItem.id === itemId ? {...typeItem, selected: true} : typeItem
          )
    )
  );

  private readonly _prefilledFieldTypeItemId$ = new BehaviorSubject<string | null>(null);
  private readonly _fieldTypeItems$: Observable<ListItem[]> = combineLatest([
    this._dataTypeValue$.pipe(distinctUntilChanged()),
    this.translateService.stream('key'),
  ]).pipe(
    map(([dataTypeValue]) => [
      {
        content: this.translateService.instant('searchFieldsOverview.textContains'),
        id: TaskListSearchFieldFieldType.TEXT_CONTAINS,
        selected: false,
      },
      {
        content: this.translateService.instant('searchFieldsOverview.single'),
        id: TaskListSearchFieldFieldType.SINGLE,
        selected: false,
      },
      {
        content: this.translateService.instant('searchFieldsOverview.range'),
        id: TaskListSearchFieldFieldType.RANGE,
        selected: false,
      },
      ...(dataTypeValue === TaskListSearchFieldDataType.TEXT
        ? [
            {
              content: this.translateService.instant('searchFieldsOverview.single-select-dropdown'),
              id: TaskListSearchFieldFieldType.SINGLE_SELECT_DROPDOWN,
              selected: false,
            },
            {
              content: this.translateService.instant('searchFieldsOverview.multi-select-dropdown'),
              id: TaskListSearchFieldFieldType.MULTI_SELECT_DROPDOWN,
              selected: false,
            },
          ]
        : []),
    ])
  );
  public fieldTypeItems$: Observable<ListItem[]> = combineLatest([
    this._fieldTypeItems$,
    this._prefilledFieldTypeItemId$,
  ]).pipe(
    filter(([fieldTypeItems]) => !!fieldTypeItems),
    map(([fieldTypeItems, itemId]) =>
      !itemId
        ? fieldTypeItems
        : fieldTypeItems.map((typeItem: ListItem) =>
            typeItem.id === itemId ? {...typeItem, selected: true} : typeItem
          )
    )
  );

  private readonly _prefilledDataProviderItemId$ = new BehaviorSubject<string | null>(null);
  private readonly _dataProviderItems$: Observable<ListItem[]> = this.translateService
    .stream('key')
    .pipe(
      map(() => [
        {
          content: this.translateService.instant(
            'searchFieldsOverview.dropdownDatabaseDataProvider'
          ),
          id: TaskListSearchDropdownDataProvider.DATABASE,
          selected: false,
        },
        {
          content: this.translateService.instant(
            'searchFieldsOverview.dropdownJsonFileDataProvider'
          ),
          id: TaskListSearchDropdownDataProvider.JSON,
          selected: false,
        },
      ])
    );
  public dataProviderItems$: Observable<ListItem[]> = combineLatest([
    this._dataProviderItems$,
    this._prefilledDataProviderItemId$,
  ]).pipe(
    filter(([dataProviderItems]) => !!dataProviderItems),
    map(([dataProviderItems, itemId]) =>
      !itemId
        ? dataProviderItems
        : dataProviderItems.map((typeItem: ListItem) =>
            typeItem.id === itemId ? {...typeItem, selected: true} : typeItem
          )
    )
  );

  private readonly _prefilledMatchTypeItemId$ = new BehaviorSubject<string | null>(null);
  private readonly _matchTypeItems$: Observable<ListItem[]> = this.translateService
    .stream('key')
    .pipe(
      map(() => [
        {
          content: this.translateService.instant('searchFieldsOverview.like'),
          id: TaskListSearchFieldMatchType.LIKE,
          selected: false,
        },
        {
          content: this.translateService.instant('searchFieldsOverview.exact'),
          id: TaskListSearchFieldMatchType.EXACT,
          selected: false,
        },
      ])
    );
  public matchTypeItems$: Observable<ListItem[]> = combineLatest([
    this._prefilledMatchTypeItemId$,
    this._matchTypeItems$,
  ]).pipe(
    map(([itemId, matchTypeItems]) =>
      !itemId
        ? matchTypeItems
        : matchTypeItems.map((typeItem: ListItem) =>
            typeItem.id === itemId ? {...typeItem, selected: true} : typeItem
          )
    )
  );

  constructor(
    private readonly documentService: DocumentService,
    private readonly iconService: IconService,
    private readonly fb: FormBuilder,
    private readonly translateService: TranslateService
  ) {
    this.iconService.registerAll([TrashCan16, InformationFilled16]);
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
    const groupValue = this.form.getRawValue();
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

  private setPrefilledForm(prefillData: TaskListSearchField | null): void {
    if (!prefillData) return;

    this.form.patchValue(
      {
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
      },
      {emitEvent: false}
    );
    if (prefillData.dropdownDataProvider && prefillData.dropdownValues)
      this.setPrefilledDropdownValues(prefillData.dropdownValues);
    this.form.get('key')?.disable();
  }

  private setPrefilledDropdowns(prefillData: TaskListSearchField | null): void {
    if (!prefillData) return;

    if (!!prefillData.dataType) this._prefilledDataTypeItemId$.next(prefillData.dataType);

    if (!!prefillData.fieldType) this._prefilledFieldTypeItemId$.next(prefillData.fieldType);

    if (!!prefillData.matchType) this._prefilledMatchTypeItemId$.next(prefillData.matchType);

    if (!!prefillData.dropdownDataProvider)
      this._prefilledDataProviderItemId$.next(prefillData.dropdownDataProvider);
  }

  private setPrefilledDropdownValues(dropdownValue: TaskListSearchDropdownValue): void {
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
      dataTypeControlValue?.id === TaskListSearchFieldDataType.TEXT &&
      (!controlValue || !controlValue.selected)
    )
      return {error: 'Match type not selected'};

    return null;
  }

  private dropdownDataProviderValidator(control: AbstractControl): null | {[key: string]: string} {
    const controlValue: string | undefined = control.value;
    const fieldTypeControlValue: ListItem | null | undefined =
      control.parent?.get('fieldType')?.value;

    if (
      [
        TaskListSearchFieldFieldType.SINGLE_SELECT_DROPDOWN,
        TaskListSearchFieldFieldType.MULTI_SELECT_DROPDOWN,
      ].includes(fieldTypeControlValue?.id) &&
      !controlValue
    )
      return {error: 'Dropdown source provider is not specified'};

    return null;
  }

  private dropdownValuesValidator(control: AbstractControl): null | {[key: string]: string} {
    const controlValue: {key: string; value: string}[] | undefined = control.value;
    const fieldTypeControlValue = control.parent?.get('fieldType')?.value?.id;
    const dropdownProviderValue = control.parent?.get('dropdownDataProvider')?.value?.id;

    if (
      (!controlValue || controlValue?.length === 0) &&
      [
        TaskListSearchFieldFieldType.SINGLE_SELECT_DROPDOWN,
        TaskListSearchFieldFieldType.MULTI_SELECT_DROPDOWN,
      ].includes(fieldTypeControlValue) &&
      dropdownProviderValue === TaskListSearchDropdownDataProvider.DATABASE
    )
      return {error: 'Dropdown source provider is not specified or is empty'};

    return null;
  }

  private resetForm(): void {
    setTimeout(() => {
      while (!!this.dropdownValuesArray?.length) {
        this.dropdownValuesArray.removeAt(0);
      }
      this.form.reset();
      this.form.enable();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
}
