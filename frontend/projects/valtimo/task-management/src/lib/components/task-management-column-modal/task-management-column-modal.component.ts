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

import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {
  CARBON_CONSTANTS,
  CARBON_THEME,
  CarbonListModule,
  CarbonMultiInputModule,
  MultiInputValues,
  TooltipIconModule,
  ValtimoCdsModalDirectiveModule,
  ViewType,
} from '@valtimo/components';
import {CommonModule} from '@angular/common';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  ButtonModule,
  CheckboxModule,
  DropdownModule,
  InputModule,
  ModalModule,
  TabsModule,
} from 'carbon-components-angular';
import {TaskManagementApiService} from '../../services';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {BehaviorSubject, combineLatest, map, Observable, of, tap} from 'rxjs';
import {
  TaskListColumn,
  TaskListColumnDefaultSort,
  TaskListColumnEnum,
  TaskListColumnListItem,
  TaskListColumnModalCloseEvent,
  TaskListColumnModalType,
} from '@valtimo/task';
import {distinctUntilChanged} from 'rxjs/operators';
import {isEqual} from 'lodash';

@Component({
  selector: 'valtimo-task-management-column-modal',
  templateUrl: './task-management-column-modal.component.html',
  styleUrls: ['./task-management-column-modal.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    CarbonListModule,
    TranslateModule,
    TabsModule,
    FormsModule,
    ModalModule,
    CheckboxModule,
    DropdownModule,
    InputModule,
    ReactiveFormsModule,
    TooltipIconModule,
    CarbonMultiInputModule,
    ButtonModule,
    ValtimoCdsModalDirectiveModule,
  ],
})
export class TaskManagementColumnModalComponent {
  @Input() public carbonTheme: CARBON_THEME = CARBON_THEME.G10;
  @Input() public set taskListColumns(value: TaskListColumn[]) {
    if (value?.length > 0) {
      this._taskListColumns$.next(value);
    }
  }
  @Input() public set type(value: TaskListColumnModalType) {
    this.type$.next(value);
  }
  public get type(): TaskListColumnModalType {
    return this.type$.getValue();
  }
  @Input() public set show(showModal: boolean) {
    this.show$.next(showModal);
    if (showModal) this.enable();
    if (!showModal) this.resetFormAfterTimeout();
  }
  @Input() public documentDefinitionName!: string;
  @Input() public set selectedTaskListColumn(column: TaskListColumn) {
    if (column) this.prefillForm(column);
  }
  @Output() closeEvent = new EventEmitter<TaskListColumnModalCloseEvent>();

  public readonly type$ = new BehaviorSubject<TaskListColumnModalType>('add');
  public readonly isAdd$ = this.type$.pipe(map(type => type === 'add'));
  public readonly isEdit$ = this.type$.pipe(
    map(type => type === 'edit'),
    tap(isEdit => {
      if (isEdit) {
        this.key.disable();
      } else {
        this.key.enable();
      }
    })
  );
  public readonly show$ = new BehaviorSubject<boolean>(false);
  public readonly disabled$ = new BehaviorSubject<boolean>(false);

  private readonly _taskListColumns$ = new BehaviorSubject<TaskListColumn[]>([]);

  public get taskListColumns$(): Observable<TaskListColumn[]> {
    return this._taskListColumns$.pipe(
      distinctUntilChanged((previous, current) => isEqual(previous, current))
    );
  }

  private readonly _INVALID_KEY = 'INVALID_KEY';

  private readonly DISPLAY_TYPES: Array<ViewType> = [
    ViewType.TEXT,
    ViewType.DATE,
    ViewType.BOOLEAN,
    ViewType.ENUM,
    ViewType.ARRAY_COUNT,
    ViewType.UNDERSCORES_TO_SPACES,
  ];

  private getInvalidListItem = (translateKey: string): TaskListColumnListItem => ({
    content: this.translateService.instant(translateKey),
    key: this._INVALID_KEY,
    selected: true,
  });

  private uniqueKeyValidator = (
    keyFormControl: AbstractControl<TaskListColumnListItem>
  ): {notUnique: boolean} | null => {
    const taskListColumns = this._taskListColumns$.getValue();

    return !taskListColumns?.find(
      column => column?.key?.trim()?.toLowerCase() === keyFormControl?.value?.trim()?.toLowerCase()
    )
      ? null
      : {notUnique: true};
  };

  private listItemValidator = (
    listItemControl: AbstractControl<TaskListColumnListItem>
  ): {invalidItem: boolean} | null =>
    listItemControl?.value?.key && listItemControl.value.key !== this._INVALID_KEY
      ? null
      : {invalidItem: true};

  public readonly formGroup = new FormGroup({
    title: new FormControl(null),
    key: new FormControl(null, [this.uniqueKeyValidator.bind(this), Validators.required]),
    path: new FormControl(null, Validators.required),
    dateFormat: new FormControl(null),
    displayType: new FormControl(this.getInvalidListItem(`listColumn.selectDefaultSort`), [
      Validators.required,
      this.listItemValidator.bind(this),
    ]),
    sortable: new FormControl(false),
    defaultSort: new FormControl(this.getInvalidListItem(`listColumn.selectDefaultSort`), [
      Validators.required,
    ]),
  });

  public get title(): AbstractControl<string> {
    return this.formGroup.get('title');
  }
  public get key(): AbstractControl<string> {
    return this.formGroup.get('key');
  }
  public get keyValue$(): Observable<string> {
    return this.key.valueChanges.pipe(distinctUntilChanged());
  }
  public get path(): AbstractControl<string> {
    return this.formGroup.get('path');
  }
  public get dateFormat(): AbstractControl<string> {
    return this.formGroup.get('dateFormat');
  }
  public get displayType(): AbstractControl<TaskListColumnListItem> {
    return this.formGroup.get('displayType');
  }
  public get sortable(): AbstractControl<boolean> {
    return this.formGroup.get('sortable');
  }
  public get defaultSort(): AbstractControl<TaskListColumnListItem> {
    return this.formGroup.get('defaultSort');
  }

  private get _SORT_ASC_ITEM() {
    return {
      content: this.translateService.instant(`listColumn.sortableAsc`),
      key: 'ASC',
    } as TaskListColumnListItem;
  }
  private get _SORT_DESC_ITEM() {
    return {
      content: this.translateService.instant(`listColumn.sortableDesc`),
      key: 'DESC',
    } as TaskListColumnListItem;
  }
  public readonly sortItems$: Observable<Array<TaskListColumnListItem>> = combineLatest([
    this.defaultSort?.valueChanges || of(null),
    this.translateService.stream('key'),
  ]).pipe(
    map(([defaultSortItem]) =>
      [
        this.getInvalidListItem(`listColumn.selectDefaultSort`),
        this._SORT_ASC_ITEM,
        this._SORT_DESC_ITEM,
      ].map((item, index) => ({
        ...item,
        selected: defaultSortItem?.key === item?.key,
      }))
    )
  );

  public readonly viewTypeItems$: Observable<Array<TaskListColumnListItem>> = combineLatest([
    this.displayType?.valueChanges || of(null),
    this.translateService.stream('key'),
  ]).pipe(
    map(([displayTypeItem]) =>
      [
        {
          content: this.translateService.instant(`listColumnDisplayType.select`),
          key: this._INVALID_KEY,
        },
        ...this.DISPLAY_TYPES.map(type => this.getListItemFromViewType(type)),
      ].map((item, index) => ({
        ...item,
        selected: displayTypeItem?.key === item?.key,
      }))
    )
  );

  private _showDateFormat!: boolean;
  public readonly showDateFormat$ = this.formGroup.valueChanges.pipe(
    map(formValues => !!(formValues.displayType?.key === this.DISPLAY_TYPES[1])),
    tap(showDateFormat => (this._showDateFormat = showDateFormat))
  );

  private _showEnum!: boolean;
  public readonly showEnum$ = this.formGroup.valueChanges.pipe(
    map(formValues => !!(formValues.displayType?.key === ViewType.ENUM)),
    tap(showEnum => {
      this._showEnum = showEnum;
      if ((this._enumValues$.getValue() || []).length === 0) this.resetEnumValues();
    })
  );

  private _showYesNo!: boolean;
  public readonly showYesNo$ = this.formGroup.valueChanges.pipe(
    map(formValues => !!(formValues.displayType?.key === ViewType.BOOLEAN)),
    tap(showYesNo => {
      this._showYesNo = showYesNo;
      if ((this._yesNoValues$.getValue() || []).length === 0) this.resetYesNoValues();
    })
  );

  public readonly CARBON_THEME_WHITE = CARBON_THEME.WHITE;

  public readonly disableDefaultSort$ = combineLatest([this.taskListColumns$, this.keyValue$]).pipe(
    map(([taskListColumns, keyValue]) => {
      const defaultSortColumn = taskListColumns.find(
        column =>
          column?.defaultSort === TaskListColumnDefaultSort.ASC ||
          column?.defaultSort === TaskListColumnDefaultSort.DESC
      );
      const defaultSortColumnExists = !!defaultSortColumn;
      const enabled = !defaultSortColumnExists || defaultSortColumn.key === keyValue;

      if (enabled) {
        this.defaultSort?.enable();
      } else {
        this.defaultSort?.disable();
      }

      return !enabled;
    })
  );

  private readonly _DEFAULT_ENUM_VALUES: MultiInputValues = [{key: '', value: ''}];

  private readonly _enumValues$ = new BehaviorSubject<MultiInputValues>(this._DEFAULT_ENUM_VALUES);

  public get enumValues$(): Observable<MultiInputValues> {
    return this._enumValues$.pipe(
      distinctUntilChanged((previous, current) => isEqual(previous, current))
    );
  }

  public get enumValid$(): Observable<boolean> {
    return this.enumValues$.pipe(map(values => this.getValidEnumValues(values).length > 0));
  }

  private readonly _yesNoValues$ = new BehaviorSubject<MultiInputValues>(this._DEFAULT_ENUM_VALUES);

  public get yesNoValues$(): Observable<MultiInputValues> {
    return this._yesNoValues$.pipe(
      distinctUntilChanged((previous, current) => isEqual(previous, current))
    );
  }

  constructor(
    private readonly translateService: TranslateService,
    private readonly taskManagementApiService: TaskManagementApiService
  ) {}

  public closeModal(): void {
    this.closeEvent.emit('close');
  }

  public save(): void {
    this.disable();

    this.taskManagementApiService
      .updateTaskListColumn(
        this.documentDefinitionName,
        this.getTaskListColumnFromFormValue(this._showEnum, this._showDateFormat, this._showYesNo)
      )
      .subscribe({
        next: () => {
          this.closeModalAndRefresh();
          this.enableAfterTimeout();
        },
        error: () => {
          this.enable();
        },
      });
  }

  public enumValueChange(value: MultiInputValues): void {
    this._enumValues$.next(value);
  }

  public yesNoValueChange(value: MultiInputValues): void {
    this._yesNoValues$.next(value);
  }

  private resetEnumValues(): void {
    this._enumValues$.next(this._DEFAULT_ENUM_VALUES);
  }

  private resetYesNoValues(): void {
    this._yesNoValues$.next(this._DEFAULT_ENUM_VALUES);
  }

  private resetFormAfterTimeout(): void {
    setTimeout(() => {
      this.resetForm();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }

  private resetForm(): void {
    this.resetEnumValues();
    this.resetYesNoValues();
    this.formGroup.reset({
      title: null,
      key: null,
      dateFormat: null,
      displayType: this.getInvalidListItem('listColumnDisplayType.select'),
      sortable: false,
      defaultSort: this.getInvalidListItem(`listColumn.selectDefaultSort`),
    });
  }

  private disable(): void {
    this.disabled$.next(true);
  }

  private enableAfterTimeout(): void {
    setTimeout(() => {
      this.enable();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }

  private enable(): void {
    this.disabled$.next(false);
  }

  private closeModalAndRefresh(): void {
    this.closeEvent.emit('refresh');
  }

  private getTaskListColumnFromFormValue(
    includeEnum: boolean,
    includeDateFormat: boolean,
    includeYesNo: boolean
  ): TaskListColumn {
    const validEnumValues = this.getValidEnumValues(this._enumValues$.getValue());
    const mappedEnumValues =
      validEnumValues && validEnumValues.length > 0 && this.mapEnumValues(validEnumValues);
    const validYesNoValues = this.getValidEnumValues(this._yesNoValues$.getValue());
    const mappedYesNoValues =
      validYesNoValues && validYesNoValues.length > 0 && this.mapEnumValues(validYesNoValues);

    const formValue = this.formGroup.getRawValue();
    const taskListColumn: TaskListColumn = {
      ...(formValue.title && {title: formValue.title}),
      key: formValue.key,
      path: formValue.path,
      displayType: {
        type: formValue.displayType.key,
        displayTypeParameters: {
          ...(includeDateFormat && formValue.dateFormat && {dateFormat: formValue.dateFormat}),
          ...(includeEnum && mappedEnumValues && {enum: mappedEnumValues}),
          ...(includeYesNo && mappedYesNoValues && {enum: mappedYesNoValues}),
        },
      },
      sortable: formValue.sortable,
      ...(formValue.defaultSort.key !== this._INVALID_KEY && {
        defaultSort: formValue.defaultSort.key as TaskListColumnDefaultSort,
      }),
    };

    return taskListColumn;
  }

  private mapEnumValues(enumValues: MultiInputValues): TaskListColumnEnum {
    return enumValues.reduce((acc, curr) => ({...acc, [curr.key]: curr.value}), {});
  }

  private getValidEnumValues(values: MultiInputValues): MultiInputValues {
    return (values || []).filter(value => value.value && value.key);
  }

  private getListItemFromViewType(viewType: ViewType | string): TaskListColumnListItem {
    return {
      content: this.translateService.instant(`listColumnDisplayType.${viewType}`),
      key: viewType,
    } as TaskListColumnListItem;
  }

  private getMultiInputValuesFromTaskListColumnEnum(
    taskListColumnEnum: TaskListColumnEnum
  ): MultiInputValues {
    return Object.keys(taskListColumnEnum).reduce(
      (acc, curr) => [...acc, {key: curr, value: taskListColumnEnum[curr]}],
      []
    );
  }

  private prefillForm(column: TaskListColumn): void {
    if (
      column?.displayType?.type === ViewType.ENUM &&
      column?.displayType?.displayTypeParameters?.enum
    ) {
      this._enumValues$.next(
        this.getMultiInputValuesFromTaskListColumnEnum(
          column.displayType.displayTypeParameters.enum
        )
      );
    }

    if (
      column?.displayType?.type === ViewType.BOOLEAN &&
      column?.displayType?.displayTypeParameters?.enum
    ) {
      this._yesNoValues$.next(
        this.getMultiInputValuesFromTaskListColumnEnum(
          column.displayType.displayTypeParameters.enum
        )
      );
    }

    this.formGroup.patchValue({
      key: column.key,
      path: column.path,
      sortable: column.sortable,
      displayType: this.getListItemFromViewType(column.displayType.type),
      ...(column.title && {title: column.title}),
      ...(!column.defaultSort && {
        defaultSort: this.getInvalidListItem(`listColumn.selectDefaultSort`),
      }),
      ...(column.defaultSort === 'ASC' && {defaultSort: this._SORT_ASC_ITEM}),
      ...(column.defaultSort === 'DESC' && {defaultSort: this._SORT_DESC_ITEM}),
      ...(column.displayType?.type === ViewType.DATE && {
        dateFormat: column.displayType.displayTypeParameters.dateFormat,
      }),
    });
  }
}
