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
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {CARBON_CONSTANTS} from '@valtimo/components';
import {
  TaskListSearchField,
  TaskListSearchFieldDataType,
  TaskListSearchFieldFieldType,
  TaskListSearchFieldMatchType,
} from '@valtimo/task';
import {
  ButtonModule,
  DropdownModule,
  InputModule,
  ListItem,
  ModalModule,
} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, debounceTime, map, Observable} from 'rxjs';

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
  ],
})
export class TaskManagementSearchFieldsModalComponent {
  @Input({required: true}) open: boolean;

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
    dropdownDataProvider: this.fb.control<string>('', this.dropdownDataProviderValidator),
  });

  public readonly TaskListSearchFieldDataType = TaskListSearchFieldDataType;
  public readonly TaskListSearchFieldFieldType = TaskListSearchFieldFieldType;

  public get dataTypeValue(): string | null {
    const controlValue = this.form.get('dataType')?.value;

    return !controlValue ? null : controlValue.id;
  }

  public get fieldTypeValue(): string | null {
    const controlValue = this.form.get('fieldType')?.value;

    return !controlValue ? null : controlValue.id;
  }

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
    this._prefilledDataTypeItemId$,
    this._dataTypeItems$,
  ]).pipe(
    map(([itemId, dataTypeItems]) =>
      !itemId
        ? dataTypeItems
        : dataTypeItems.map((typeItem: ListItem) =>
            typeItem.id === itemId ? {...typeItem, selected: true} : typeItem
          )
    )
  );

  private readonly _prefilledFieldTypeItemId$ = new BehaviorSubject<string | null>(null);
  private readonly _fieldTypeItems$: Observable<ListItem[]> = this.translateService
    .stream('key')
    .pipe(
      map(() => [
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
      ])
    );
  public fieldTypeItems$: Observable<ListItem[]> = combineLatest([
    this._prefilledFieldTypeItemId$,
    this._fieldTypeItems$,
  ]).pipe(
    map(([itemId, fieldTypeItems]) =>
      !itemId
        ? fieldTypeItems
        : fieldTypeItems.map((typeItem: ListItem) =>
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
    private readonly fb: FormBuilder,
    private readonly translateService: TranslateService
  ) {}

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
      ...(groupValue.dropdownDataProvider && {
        dropdownDataProvider: groupValue.dropdownDataProvider,
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
      },
      {emitEvent: false}
    );
    this.form.get('key')?.disable();
  }

  private setPrefilledDropdowns(prefillData: TaskListSearchField | null): void {
    if (!prefillData) return;

    if (!!prefillData.dataType) this._prefilledDataTypeItemId$.next(prefillData.dataType);

    if (!!prefillData.fieldType) this._prefilledFieldTypeItemId$.next(prefillData.fieldType);

    if (!!prefillData.matchType) this._prefilledMatchTypeItemId$.next(prefillData.matchType);
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

  private resetForm(): void {
    setTimeout(() => {
      this.form.reset();
      this.form.enable();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
}
