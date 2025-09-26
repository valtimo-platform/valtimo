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
import {AfterViewInit, Component, Input} from '@angular/core';
import {FormControl, FormGroup, Validators} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {ArrowDown16, ArrowUp16} from '@carbon/icons';
import {TranslateService} from '@ngx-translate/core';
import {
  ActionItem,
  ColumnConfig,
  MultiInputValues,
  ValuePathSelectorPrefix,
  ViewType,
} from '@valtimo/components';
import {ConfigService} from '@valtimo/config';
import {
  CaseListColumn,
  CaseListColumnView,
  DisplayTypeParameters,
  DocumentService,
} from '@valtimo/document';
import {IconService, ListItem} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  delay,
  map,
  Observable,
  startWith,
  Subject,
  switchMap,
  tap,
} from 'rxjs';
import {take} from 'rxjs/operators';
import {ListColumnModal} from '../../../../models';
import {v4 as uuidv4} from 'uuid';
import {getCaseManagementRouteParams} from '../../../../utils';

@Component({
  standalone: false,
  templateUrl: './case-management-list-columns.component.html',
  styleUrls: ['./case-management-list-columns.component.scss'],
})
export class CaseManagementListColumnsComponent implements AfterViewInit {
  @Input() public readonly canUpdateGlobalConfiguration;
  @Input() public readonly isFinalVersion;

  readonly downloadName$ = new BehaviorSubject<string>('');
  readonly downloadUrl$ = new BehaviorSubject<string | null>(null);

  public readonly actionItems: ActionItem[] = [
    {
      label: 'interface.delete',
      callback: this.deleteRow.bind(this),
      type: 'danger',
    },
  ];

  public readonly loadingCaseListColumns$ = new BehaviorSubject<boolean>(true);

  public readonly lastItemIndex$ = new BehaviorSubject<number>(-1);

  public readonly fields: Array<ColumnConfig> = [
    {
      viewType: 'string',
      sortable: false,
      key: 'title',
      label: 'listColumn.title',
    },
    {
      viewType: 'string',
      sortable: false,
      key: 'key',
      label: 'listColumn.key',
    },
    {
      viewType: 'string',
      sortable: false,
      key: 'path',
      label: 'listColumn.path',
    },
    {
      viewType: 'string',
      sortable: false,
      key: 'displayType',
      label: 'listColumn.displayType',
    },
    {
      viewType: 'string',
      sortable: false,
      key: 'displayTypeParameters',
      label: 'listColumn.displayTypeParameters',
    },
    {
      viewType: 'string',
      sortable: false,
      key: 'sortable',
      label: 'listColumn.sortable',
    },
    {
      viewType: 'string',
      sortable: false,
      key: 'defaultSort',
      label: 'listColumn.defaultSort',
    },
  ];

  readonly params$ = getCaseManagementRouteParams(this.route);
  readonly disableInput$ = new BehaviorSubject<boolean>(false);

  private cachedCaseListColumns: Array<CaseListColumn> = [];

  private readonly refreshCaseListcolumns$ = new BehaviorSubject<null>(null);

  private readonly caseListColumns$: Observable<Array<CaseListColumn>> = combineLatest([
    this.params$,
    this.refreshCaseListcolumns$,
  ]).pipe(
    switchMap(([params]) =>
      this.documentService.getCaseListForManagement(params.caseDefinitionKey)
    ),
    map(caseListColumns => caseListColumns.map(column => ({...column, uuid: uuidv4()}))),
    tap(caseListColumns => {
      this.params$.pipe(take(1)).subscribe(params => {
        if (caseListColumns && Array.isArray(caseListColumns) && caseListColumns.length > 0) {
          this.setDownload(params.caseDefinitionKey, caseListColumns);
        }
      });
    }),
    tap(caseListColumns => {
      this.lastItemIndex$.next(caseListColumns.length - 1);
      this.cachedCaseListColumns = caseListColumns;
      this.loadingCaseListColumns$.next(false);
      this.enableInput();
    })
  );

  public readonly canUpdateGlobalConfiguration$: Observable<boolean> =
    this.environmentService.canUpdateGlobalConfiguration();

  public readonly isFinalVersion$: Observable<boolean> = combineLatest([
    this.caseDefinitionKey$,
    this.caseDefinitionVersionTag$,
  ]).pipe(
    switchMap(([caseDefinitionKey, caseDefinitionVersionTag]) =>
      this.caseManagementService.getCaseDefinition(caseDefinitionKey, caseDefinitionVersionTag)
    ),
    map(caseDefinition => caseDefinition.final)
  );

  public readonly translatedCaseListColumns$: Observable<Array<CaseListColumnView>> = combineLatest(
    [this.caseListColumns$, this.translateService.stream('key')]
  ).pipe(
    map(([columns]) =>
      columns.map(column => ({
        ...column,
        title: column.title || '-',
        sortable: column.sortable
          ? this.translateService.instant('listColumn.sortableYes')
          : this.translateService.instant('listColumn.sortableNo'),
        defaultSort:
          (column.defaultSort === 'ASC' &&
            this.translateService.instant('listColumn.sortableAsc')) ||
          (column.defaultSort === 'DESC' &&
            this.translateService.instant('listColumn.sortableDesc')) ||
          '-',
        displayType: this.translateService.instant(
          `listColumnDisplayType.${column?.displayType?.type}`
        ),
        displayTypeParameters: this.getDisplayTypeParametersView(
          column.displayType.displayTypeParameters
        ),
      }))
    )
  );

  public readonly currentModalType$ = new BehaviorSubject<ListColumnModal>('create');

  public readonly showModal$ = new BehaviorSubject<boolean>(false);

  public readonly modalShowing$ = this.showModal$.pipe(delay(250));

  public readonly INVALID_KEY = 'invalid';

  public readonly formGroup = new FormGroup({
    title: new FormControl(''),
    key: new FormControl('', Validators.required),
    path: new FormControl('', Validators.required),
    dateFormat: new FormControl(''),
    displayType: new FormControl({
      key: this.INVALID_KEY,
    }),
    sortable: new FormControl(false),
    defaultSort: new FormControl({
      key: this.INVALID_KEY,
    }),
    enum: new FormControl([]),
    tagAmount: new FormControl(1),
  });

  public readonly disableDefaultSort$ = combineLatest([
    this.currentModalType$,
    this.formGroup.valueChanges,
  ]).pipe(
    map(
      ([currentModalType]) =>
        currentModalType === 'create' &&
        this.cachedCaseListColumns.find(column => !!column.defaultSort)
    ),
    startWith(false)
  );

  public readonly DISPLAY_TYPES: Array<ViewType> = [
    ViewType.TEXT,
    ViewType.DATE,
    ViewType.BOOLEAN,
    ViewType.ENUM,
    ViewType.ARRAY_COUNT,
    ViewType.UNDERSCORES_TO_SPACES,
    ViewType.TAGS,
  ];

  public readonly showDateFormat$ = this.formGroup.valueChanges.pipe(
    map(formValues => !!(formValues.displayType?.key === this.DISPLAY_TYPES[1])),
    tap(showDateFormat => {
      if (showDateFormat === false && !!this.formGroup.value.dateFormat) {
        this.formGroup.patchValue({dateFormat: ''});
      }
    }),
    startWith(false)
  );

  public readonly showTagAmount$ = this.formGroup.valueChanges.pipe(
    map(formValues => formValues.displayType?.key === this.DISPLAY_TYPES[6]),
    startWith(this.formGroup.value.displayType?.key === this.DISPLAY_TYPES[6] ? true : false)
  );

  public readonly showEnum$ = this.formGroup.valueChanges.pipe(
    map(
      formValues =>
        !!(
          formValues.displayType?.key === this.DISPLAY_TYPES[3] ||
          formValues.displayType?.key === this.DISPLAY_TYPES[2]
        )
    ),
    tap(showEnum => {
      const enumValue = this.formGroup.value.enum;
      if (showEnum === false && Array.isArray(enumValue) && enumValue.length > 0) {
        this.formGroup.patchValue({enum: []});
      }
    }),
    startWith(false)
  );

  public readonly isYesNo$ = this.formGroup.valueChanges.pipe(
    map(formValues => !!(formValues.displayType?.key === this.DISPLAY_TYPES[2]))
  );

  public readonly selectedViewTypeItemIndex$ = new BehaviorSubject<number>(0);

  public readonly viewTypeItems$: Observable<Array<ListItem>> = combineLatest([
    this.selectedViewTypeItemIndex$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([selectedViewTypeItemIndex]) =>
      [
        {
          content: this.translateService.instant(`listColumnDisplayType.select`),
          key: this.INVALID_KEY,
        },
        ...this.DISPLAY_TYPES.map(type => ({
          content: this.translateService.instant(`listColumnDisplayType.${type}`),
          key: type,
        })),
      ].map((item, index) => ({
        ...item,
        selected: index === selectedViewTypeItemIndex,
      }))
    )
  );

  public readonly selectedSortItemIndex$ = new BehaviorSubject<number>(0);

  public readonly sortItems$: Observable<Array<ListItem>> = combineLatest([
    this.selectedSortItemIndex$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([selectedSortItemIndex]) =>
      [
        {
          content: this.translateService.instant(`listColumn.selectDefaultSort`),
          key: this.INVALID_KEY,
        },
        {
          content: this.translateService.instant(`listColumn.sortableAsc`),
          key: 'ASC',
        },
        {
          content: this.translateService.instant(`listColumn.sortableDesc`),
          key: 'DESC',
        },
      ].map((item, index) => ({
        ...item,
        selected: index === selectedSortItemIndex,
      }))
    )
  );

  public readonly validKey$ = combineLatest([
    this.formGroup.valueChanges,
    this.currentModalType$,
  ]).pipe(
    map(([formValues, currentModalType]) => {
      const existingKeys = this.cachedCaseListColumns.map(column => column.key);
      return currentModalType === 'create' ? !existingKeys.includes(formValues.key ?? '') : true;
    }),
    startWith(false)
  );

  public readonly valid$ = combineLatest([this.formGroup.valueChanges, this.validKey$]).pipe(
    map(
      ([formValues, validKey]) =>
        !!(
          formValues.displayType?.key !== this.INVALID_KEY &&
          formValues.path &&
          validKey &&
          (formValues?.displayType?.key === 'enum' ? formValues.enum?.length > 0 : true) &&
          (formValues?.displayType?.key === 'tags' ? formValues.tagAmount > 0 : true)
        )
    ),
    startWith(false)
  );

  public readonly showDeleteModal$ = new Subject<boolean>();

  public readonly deleteRowKey$ = new BehaviorSubject<string>('');

  public readonly defaultEnumValues$ = new BehaviorSubject<MultiInputValues | null>(null);

  public readonly ValuePathSelectorPrefix = ValuePathSelectorPrefix;

  constructor(
    private readonly documentService: DocumentService,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService,
    private readonly configService: ConfigService,
    private readonly iconService: IconService
  ) {}

  public ngAfterViewInit(): void {
    this.iconService.registerAll([ArrowDown16, ArrowUp16]);
  }

  openModal(modalType: ListColumnModal): void {
    this.showModal$.next(true);
    this.currentModalType$.next(modalType);

    if (modalType === 'create') {
      this.formGroup.controls['key'].enable();
      this.resetFormGroup();
    } else if (modalType === 'edit') {
      this.formGroup.controls['key'].disable();
    }
  }

  closeModal(): void {
    this.showModal$.next(false);
  }

  deleteRow(caseListColumn: CaseListColumn): void {
    if (!this.canUpdateGlobalConfiguration || this.isFinalVersion) return;

    this.showDeleteModal$.next(true);
    this.deleteRowKey$.next(caseListColumn.key);
  }

  deleteRowConfirmation(columnKey: string): void {
    if (columnKey) {
      this.disableInput();

      this.params$.pipe(take(1)).subscribe(params => {
        this.documentService
          .deleteCaseListForManagement(params.caseDefinitionKey, columnKey)
          .subscribe({
            next: () => {
              this.refreshCaseListColumns();
            },
            error: () => {
              this.enableInput();
            },
          });
      });
    }
  }

  public onItemsReordered(caseDefinitionKey: string, items: CaseListColumn[]): void {
    if (!items || !caseDefinitionKey) return;

    const unformattedColumns = items.map(column =>
      this.cachedCaseListColumns.find(cachedColumn => cachedColumn.uuid === column.uuid)
    );

    this.updateCaseListColumns(caseDefinitionKey, unformattedColumns);
  }

  saveCaseListColumns(): void {
    this.disableInput();

    this.currentModalType$.pipe(take(1)).subscribe(currentModalType => {
      if (currentModalType === 'create') {
        this.addColumn();
      } else {
        this.updateColumn();
      }
    });
  }

  enumValueChange(value: Array<{[key: string]: string}>): void {
    this.formGroup.patchValue({enum: value});
  }

  columnRowClicked(row: {key: string}): void {
    if (!this.canUpdateGlobalConfiguration || this.isFinalVersion) return;

    this.resetFormGroup();

    combineLatest([this.viewTypeItems$, this.sortItems$])
      .pipe(take(1))
      .subscribe(([viewTypeItems, sortItems]) => {
        const column = this.cachedCaseListColumns.find(
          cachedColumn => cachedColumn.key === row.key
        );
        const viewTypeItem = viewTypeItems.find(item => item.key === column?.displayType.type);
        const viewTypeItemIndex = viewTypeItems.findIndex(
          item => item.key === column?.displayType.type
        );
        const sortItem = sortItems.find(item => item.key === column?.defaultSort);
        const sortItemIndex = sortItems.findIndex(item => item.key === column?.defaultSort);
        const enumValues = column?.displayType?.displayTypeParameters?.enum;
        const mappedEnumValues: MultiInputValues = [];
        const columnDateFormat = column?.displayType?.displayTypeParameters?.dateFormat;
        const tagAmount = column?.displayType?.displayTypeParameters?.tagAmount;

        this.selectedViewTypeItemIndex$.next(viewTypeItemIndex);

        if (sortItem) {
          this.selectedSortItemIndex$.next(sortItemIndex);
        }

        if (enumValues) {
          Object.keys(enumValues).forEach(key => {
            mappedEnumValues.push({key, value: enumValues[key]});
          });
          this.defaultEnumValues$.next(mappedEnumValues);
        } else {
          this.defaultEnumValues$.next([{key: '', value: ''}]);
        }

        this.formGroup.patchValue({
          key: column?.key,
          title: column?.title,
          path: column?.path,
          sortable: column?.sortable,
          // @ts-ignore
          displayType: {...viewTypeItem},
          // @ts-ignore
          defaultSort: sortItem ? {...sortItem} : {...sortItems[0]},
          ...(columnDateFormat && {
            dateFormat: columnDateFormat,
          }),
          ...(tagAmount && {
            tagAmount: tagAmount,
          }),
        });

        this.openModal('edit');
      });
  }

  public selectedDisplayType(event: ListItem): void {
    if (event.item.selected && event.item.key === 'tags') {
      this.formGroup.patchValue({sortable: undefined, defaultSort: undefined});
    }
  }

  public onDownloadClick(): void {
    combineLatest([this.downloadUrl$, this.downloadName$])
      .pipe(take(1))
      .subscribe(([url, name]) => {
        if (!url || !name) return;

        const anchor = document.createElement('a');
        anchor.href = url.toString();
        anchor.download = name;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      });
  }

  private updateCaseListColumns(
    caseDefinitionKey: string,
    newCaseListColumns: Array<CaseListColumn>
  ): void {
    this.disableInput();

    this.documentService.putCaseListForManagement(caseDefinitionKey, newCaseListColumns).subscribe({
      next: () => {
        this.refreshCaseListColumns();
        localStorage.setItem(`list-search-${caseDefinitionKey}`, '');
      },
      error: () => {
        this.enableInput();
      },
    });
  }

  private addColumn(): void {
    const formValue = this.formGroup.value;

    this.params$.pipe(take(1)).subscribe(params => {
      this.documentService
        .postCaseListForManagement(params.caseDefinitionKey, this.mapFormValuesToColumn(formValue))
        .subscribe({
          next: () => {
            this.closeModal();
            this.refreshCaseListColumns();
          },
          error: () => {
            this.enableInput();
          },
        });
    });
  }

  private getDisplayTypeParametersView(displayTypeParameters: DisplayTypeParameters): string {
    if (displayTypeParameters?.dateFormat) {
      return displayTypeParameters.dateFormat;
    } else if (displayTypeParameters?.tagAmount) {
      return displayTypeParameters.tagAmount.toString();
    } else if (displayTypeParameters?.enum) {
      return Object.keys(displayTypeParameters.enum).reduce((acc, curr) => {
        const keyValuePairString = `${curr}: ${displayTypeParameters.enum?.[curr]}`;
        if (!acc) {
          return `${keyValuePairString}`;
        }

        return `${acc}, ${keyValuePairString}`;
      }, '');
    }

    return '-';
  }

  private updateColumn(): void {
    const updatedColumnFormValue = this.formGroup.value;
    const mappedUpdatedColumn = this.mapFormValuesToColumn(updatedColumnFormValue);
    const currentColumns = this.cachedCaseListColumns;
    const mappedCurrentColumns = currentColumns.map(column => {
      const columnCopy = {...column};
      if (columnCopy.key === updatedColumnFormValue.key) {
        const changedColumn = {...columnCopy, ...mappedUpdatedColumn};
        if (!mappedUpdatedColumn.defaultSort) {
          delete changedColumn.defaultSort;
        }
        return changedColumn;
      }
      if (mappedUpdatedColumn.defaultSort) {
        delete columnCopy.defaultSort;
      }
      return columnCopy;
    });

    this.params$.pipe(take(1)).subscribe(params => {
      this.documentService
        .putCaseListForManagement(params.caseDefinitionKey, mappedCurrentColumns)
        .subscribe({
          next: () => {
            this.closeModal();
            this.refreshCaseListColumns();
          },
          error: () => {
            this.enableInput();
          },
        });
    });
  }

  private setDownload(caseDefinitionKey: string, caseListColumns: Array<CaseListColumn>): void {
    this.downloadName$.next(`${caseDefinitionKey}.json`);
    this.downloadUrl$.next(
      'data:text/json;charset=UTF-8,' + encodeURIComponent(JSON.stringify(caseListColumns, null, 2))
    );
  }

  private disableInput(): void {
    this.disableInput$.next(true);
    this.formGroup.disable();
  }

  private enableInput(): void {
    this.disableInput$.next(false);
    this.formGroup.enable();
    if (this.formGroup.value.displayType?.key === 'tags') {
      this.formGroup.controls.defaultSort.disable();
      this.formGroup.controls.sortable.disable();
    }
  }

  private refreshCaseListColumns(): void {
    this.refreshCaseListcolumns$.next(null);
  }

  private resetFormGroup(): void {
    this.formGroup.reset();
    combineLatest([this.sortItems$, this.viewTypeItems$])
      .pipe(take(1))
      .subscribe(([sortItems, viewTypeItems]) => {
        this.defaultEnumValues$.next([{key: '', value: ''}]);
        this.selectedViewTypeItemIndex$.next(0);
        // @ts-ignore
        this.formGroup.patchValue({displayType: viewTypeItems[0]});
        this.selectedSortItemIndex$.next(0);
        // @ts-ignore
        this.formGroup.patchValue({defaultSort: sortItems[0]});
      });
  }

  private mapFormValuesToColumn(formValue: any): CaseListColumn {
    return {
      key: formValue.key,
      sortable: formValue.sortable,
      ...(formValue.defaultSort?.key !== this.INVALID_KEY && {
        defaultSort: formValue.defaultSort?.key,
      }),
      title: formValue.title || '',
      path: formValue.path,
      displayType: {
        type: formValue.displayType?.key,
        displayTypeParameters: {
          ...(formValue.tagAmount && {tagAmount: formValue.tagAmount}),
          ...(formValue.dateFormat && {dateFormat: formValue.dateFormat}),
          ...(Array.isArray(formValue.enum) &&
            formValue.enum.length > 0 && {
              enum: formValue.enum.reduce((acc, curr) => ({...acc, [curr.key]: curr.value}), {}),
            }),
        },
      },
    };
  }
}
