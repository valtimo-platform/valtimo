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

import {Component, TemplateRef, ViewChild} from '@angular/core';
import {
  BehaviorSubject,
  combineLatest,
  delay,
  filter,
  map,
  Observable,
  of,
  startWith,
  Subject,
  switchMap,
  tap,
} from 'rxjs';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';
import {ConfigService, DefinitionColumn} from '@valtimo/config';
import {ListField, MultiInputValues} from '@valtimo/components';
import {catchError, take} from 'rxjs/operators';
import {FormControl, FormGroup, Validators} from '@angular/forms';
import {ListItem} from 'carbon-components-angular/dropdown/list-item.interface';
import {ActivatedRoute} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {ListColumnModal} from '@valtimo/dossier-management';
import {ObjectManagementService} from '../../../../services/object-management.service';
import {
  DisplayTypeParameters,
  SearchListColumn,
  SearchListColumnView,
} from '../../../../models/object-management.model';

@Component({
  selector: 'valtimo-object-management-list-columns',
  templateUrl: './object-management-list-columns.component.html',
  styleUrls: ['./object-management-list-columns.component.scss'],
})
export class ObjectManagementListColumnsComponent {
  @ViewChild('moveRowButtons') public moveRowButtonsTemplateRef: TemplateRef<any>;
  readonly downloadName$ = new BehaviorSubject<string>('');
  readonly downloadUrl$ = new BehaviorSubject<SafeUrl>(undefined);
  readonly loading$ = new BehaviorSubject<boolean>(true);
  readonly currentModalType$ = new BehaviorSubject<ListColumnModal>('create');
  readonly showModal$ = new BehaviorSubject<boolean>(false);
  readonly modalShowing$ = this.showModal$.pipe(delay(250));
  readonly disableInput$ = new BehaviorSubject<boolean>(false);
  readonly showDeleteModal$ = new Subject<boolean>();
  readonly deleteRowIndex$ = new BehaviorSubject<number>(0);
  readonly defaultEnumValues$ = new BehaviorSubject<MultiInputValues>(undefined);

  readonly INVALID_KEY = 'invalid';
  readonly formGroup = new FormGroup({
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
  });
  readonly DISPLAY_TYPES: Array<string> = [
    'string',
    'date',
    'boolean',
    'enum',
    'arrayCount',
    'underscoresToSpaces',
  ];

  private readonly COLUMNS: Array<DefinitionColumn> = [
    {
      viewType: 'string',
      sortable: false,
      propertyName: 'title',
      translationKey: 'title',
    },
    {
      viewType: 'string',
      sortable: false,
      propertyName: 'key',
      translationKey: 'key',
    },
    {
      viewType: 'string',
      sortable: false,
      propertyName: 'path',
      translationKey: 'path',
    },
    {
      viewType: 'string',
      sortable: false,
      propertyName: 'displayType',
      translationKey: 'displayType',
    },
    {
      viewType: 'string',
      sortable: false,
      propertyName: 'displayTypeParameters',
      translationKey: 'displayTypeParameters',
    },
    {
      viewType: 'string',
      sortable: false,
      propertyName: 'sortable',
      translationKey: 'sortable',
    },
    {
      viewType: 'string',
      sortable: false,
      propertyName: 'defaultSort',
      translationKey: 'defaultSort',
    },
  ];
  private cachedObjectManagementListColumns: Array<SearchListColumn> = [];
  private readonly refreshObjectManagementListColumns$ = new BehaviorSubject<null>(null);

  readonly objectManagementFields$: Observable<Array<ListField>> = this.translateService
    .stream('key')
    .pipe(
      map(() =>
        this.COLUMNS.map(column => ({
          key: column.propertyName,
          label: this.translateService.instant(`listColumn.${column.translationKey}`),
          sortable: column.sortable,
          ...(column.viewType && {viewType: column.viewType}),
          ...(column.enum && {enum: column.enum}),
        }))
      )
    );

  readonly objectId$: Observable<string> = this.route.params.pipe(
    map(params => params.id || ''),
    filter(objectId => !!objectId)
  );

  private readonly objectManagementListColumns$: Observable<Array<any>> = combineLatest([
    this.objectId$,
    this.refreshObjectManagementListColumns$,
  ]).pipe(
    switchMap(([objectId]) => this.objectManagementService.getSearchList(objectId)),
    tap(objectManagementListColumns => {
      this.objectId$.pipe(take(1)).subscribe(objectId => {
        if (
          objectManagementListColumns &&
          Array.isArray(objectManagementListColumns) &&
          objectManagementListColumns.length > 0
        ) {
          this.setDownload(objectId, objectManagementListColumns);
        }
      });
    }),
    tap(objectManagementListColumns => {
      this.cachedObjectManagementListColumns = objectManagementListColumns;
      this.loading$.next(false);
      this.enableInput();
    })
  );

  readonly translatedObjectManagementListColumns$: Observable<Array<SearchListColumnView>> =
    combineLatest([this.objectManagementListColumns$, this.translateService.stream('key')]).pipe(
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

  readonly disableDefaultSort$ = combineLatest([
    this.currentModalType$,
    this.formGroup.valueChanges,
  ]).pipe(
    map(
      ([currentModalType]) =>
        currentModalType === 'create' &&
        this.cachedObjectManagementListColumns.find(column => !!column.defaultSort)
    ),
    startWith(false)
  );

  readonly showDateFormat$ = this.formGroup.valueChanges.pipe(
    map(formValues => formValues.displayType?.key === this.DISPLAY_TYPES[1]),
    tap(showDateFormat => {
      if (showDateFormat === false && !!this.formGroup.value.dateFormat) {
        this.formGroup.patchValue({dateFormat: ''});
      }
    }),
    startWith(false)
  );

  readonly showEnum$ = this.formGroup.valueChanges.pipe(
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

  readonly isYesNo$ = this.formGroup.valueChanges.pipe(
    map(formValues => formValues.displayType?.key === this.DISPLAY_TYPES[2])
  );

  readonly selectedViewTypeItemIndex$ = new BehaviorSubject<number>(0);

  readonly viewTypeItems$: Observable<Array<ListItem>> = combineLatest([
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

  readonly selectedSortItemIndex$ = new BehaviorSubject<number>(0);

  readonly sortItems$: Observable<Array<ListItem>> = combineLatest([
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

  readonly validKey$ = combineLatest([this.formGroup.valueChanges, this.currentModalType$]).pipe(
    map(([formValues, currentModalType]) => {
      const existingKeys = this.cachedObjectManagementListColumns.map(column => column.key);
      return currentModalType === 'create' ? !existingKeys.includes(formValues.key) : true;
    }),
    startWith(false)
  );

  readonly valid$ = combineLatest([this.formGroup.valueChanges, this.validKey$]).pipe(
    map(
      ([formValues, validKey]) =>
        !!(
          formValues.displayType?.key !== this.INVALID_KEY &&
          formValues.path &&
          validKey &&
          (formValues.displayType.key === 'enum' ? formValues.enum?.length > 0 : true)
        )
    ),
    startWith(false)
  );

  constructor(
    private readonly objectManagementService: ObjectManagementService,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService,
    private readonly configService: ConfigService,
    private readonly sanitizer: DomSanitizer
  ) {}

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

  deleteRow(searchListColumnRowIndex: number, clickEvent: MouseEvent): void {
    clickEvent.stopPropagation();

    this.showDeleteModal$.next(true);
    this.deleteRowIndex$.next(searchListColumnRowIndex);
  }

  deleteRowConfirmation(searchListColumnRowIndex: number): void {
    const columnKey = this.getColumnKey(searchListColumnRowIndex);

    if (columnKey) {
      this.disableInput();

      this.objectId$
        .pipe(
          take(1),
          switchMap(objectId => this.objectManagementService.deleteSearchList(objectId, columnKey)),
          tap(() => this.refreshObjectManagementListColumns()),
          catchError(() => {
            this.enableInput();
            return of(null);
          })
        )
        .subscribe();
    }
  }

  getColumnKey(searchListColumnRowIndex: number) {
    return this.cachedObjectManagementListColumns[searchListColumnRowIndex]?.key;
  }

  moveRow(
    searchListColumnRowIndex: number,
    moveUp: boolean,
    clickEvent: MouseEvent,
    objectId: string
  ): void {
    const objectManagementListColumns = [...this.cachedObjectManagementListColumns];
    const searchListColumnRow = objectManagementListColumns[searchListColumnRowIndex];

    clickEvent.stopPropagation();
    const searchListColumnIndex = objectManagementListColumns.findIndex(
      field => field.key === searchListColumnRow.key
    );
    const foundSearchListColumn = {...objectManagementListColumns[searchListColumnIndex]};
    const filteredSearchListColumns = objectManagementListColumns.filter(
      field => field.key !== searchListColumnRow.key
    );
    const multipleSearchListColumns = objectManagementListColumns.length > 1;

    if (multipleSearchListColumns && moveUp && searchListColumnIndex > 0) {
      const searchListColumnBeforeKey = `${
        objectManagementListColumns[searchListColumnIndex - 1].key
      }`;
      const searchListColumnBeforeIndex = filteredSearchListColumns.findIndex(
        field => field.key === searchListColumnBeforeKey
      );
      filteredSearchListColumns.splice(searchListColumnBeforeIndex, 0, foundSearchListColumn);
      this.updateObjectManagementListColumn(objectId, filteredSearchListColumns);
    } else if (
      multipleSearchListColumns &&
      !moveUp &&
      searchListColumnIndex < objectManagementListColumns.length
    ) {
      const caseListColumnAfterKey = `${
        objectManagementListColumns[searchListColumnIndex + 1].key
      }`;
      const caseListColumnAfterIndex = filteredSearchListColumns.findIndex(
        field => field.key === caseListColumnAfterKey
      );
      filteredSearchListColumns.splice(caseListColumnAfterIndex + 1, 0, foundSearchListColumn);
      this.updateObjectManagementListColumn(objectId, filteredSearchListColumns);
    }
  }

  saveCasListColumns(): void {
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
    this.resetFormGroup();

    combineLatest([this.viewTypeItems$, this.sortItems$])
      .pipe(take(1))
      .subscribe(([viewTypeItems, sortItems]) => {
        const column = this.cachedObjectManagementListColumns.find(
          cachedColumn => cachedColumn.key === row.key
        );
        const viewTypeItem = viewTypeItems.find(item => item.key === column.displayType.type);
        const viewTypeItemIndex = viewTypeItems.findIndex(
          item => item.key === column.displayType.type
        );
        const sortItem = sortItems.find(item => item.key === column.defaultSort);
        const sortItemIndex = sortItems.findIndex(item => item.key === column.defaultSort);
        const enumValues = column?.displayType?.displayTypeParameters?.enum;
        const mappedEnumValues: MultiInputValues = [];
        const columnDateFormat = column?.displayType?.displayTypeParameters?.dateFormat;

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
          key: column.key,
          title: column.title,
          path: column.path,
          sortable: column.sortable,
          // @ts-ignore
          displayType: {...viewTypeItem},
          // @ts-ignore
          defaultSort: sortItem ? {...sortItem} : {...sortItems[0]},
          ...(columnDateFormat && {
            dateFormat: columnDateFormat,
          }),
        });

        this.openModal('edit');
      });
  }

  private updateObjectManagementListColumn(
    objectId: string,
    listColumn: Array<SearchListColumn>
  ): void {
    this.disableInput();
    this.objectManagementService
      .putSearchListColumns(objectId, listColumn)
      .pipe(
        tap(() => {
          this.refreshObjectManagementListColumns();
          localStorage.setItem(`list-search-${objectId}`, null);
        }),
        catchError(() => {
          this.enableInput();
          return of(null);
        })
      )
      .subscribe();
  }

  private addColumn(): void {
    const formValue = this.formGroup.value;

    this.objectId$
      .pipe(
        take(1),
        switchMap(objectId =>
          this.objectManagementService.postSearchList(
            objectId,
            this.mapFormValuesToColumn(formValue)
          )
        ),
        tap(() => {
          this.closeModal();
          this.refreshObjectManagementListColumns();
        }),
        catchError(() => {
          this.enableInput();
          return of(null);
        })
      )
      .subscribe();
  }

  private getDisplayTypeParametersView(displayTypeParameters: DisplayTypeParameters): string {
    if (displayTypeParameters?.dateFormat) {
      return displayTypeParameters.dateFormat;
    } else if (displayTypeParameters?.enum) {
      return Object.keys(displayTypeParameters.enum).reduce((acc, curr) => {
        const keyValuePairString = `${curr}: ${displayTypeParameters.enum[curr]}`;
        if (!acc) {
          return `${keyValuePairString}`;
        }

        return `${acc}, ${keyValuePairString}`;
      }, '');
    }

    return '-';
  }

  private updateColumn(): void {
    this.objectId$
      .pipe(
        take(1),
        switchMap(objectId =>
          this.objectManagementService.putSearchList(
            objectId,
            this.formGroup.value.key,
            this.mapFormValuesToColumn(this.formGroup.value)
          )
        ),
        tap(() => {
          this.closeModal();
          this.refreshObjectManagementListColumns();
        }),
        catchError(() => {
          this.enableInput();
          return of(null);
        })
      )
      .subscribe();
  }

  private setDownload(
    objectId: string,
    ObjectManagementListColumns: Array<SearchListColumn>
  ): void {
    this.downloadName$.next(`${objectId}.json`);
    this.downloadUrl$.next(
      this.sanitizer.bypassSecurityTrustUrl(
        'data:text/json;charset=UTF-8,' +
          encodeURIComponent(JSON.stringify(ObjectManagementListColumns, null, 2))
      )
    );
  }

  private disableInput(): void {
    this.disableInput$.next(true);
    this.formGroup.disable();
  }

  private enableInput(): void {
    this.disableInput$.next(false);
    this.formGroup.enable();
  }

  private refreshObjectManagementListColumns(): void {
    this.refreshObjectManagementListColumns$.next(null);
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

  private mapFormValuesToColumn(formValue: any): SearchListColumn {
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
