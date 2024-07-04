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
import {
  ConfigService,
  DefinitionColumn,
  SearchField,
  SearchFieldColumnView,
  SearchFieldDataType,
  SearchFieldFieldType,
} from '@valtimo/config';
import {ListField} from '@valtimo/components';
import {catchError, take} from 'rxjs/operators';
import {FormControl, FormGroup, Validators} from '@angular/forms';
import {ListItem} from 'carbon-components-angular/dropdown/list-item.interface';
import {ActivatedRoute} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {ObjectManagementService} from '../../../../services/object-management.service';

@Component({
  selector: 'valtimo-object-management-list-search-fields',
  templateUrl: './object-management-list-search-fields.component.html',
  styleUrls: ['./object-management-list-search-fields.component.scss'],
})
export class ObjectManagementListSearchFieldsComponent {
  @ViewChild('moveRowButtons') public moveRowButtonsTemplateRef: TemplateRef<any>;
  readonly downloadName$ = new BehaviorSubject<string>('');
  readonly downloadUrl$ = new BehaviorSubject<SafeUrl>(undefined);
  readonly loading$ = new BehaviorSubject<boolean>(true);
  readonly currentModalType$ = new BehaviorSubject<string>('create');
  readonly showModal$ = new BehaviorSubject<boolean>(false);
  readonly disableInput$ = new BehaviorSubject<boolean>(false);
  readonly showDeleteModal$ = new Subject<boolean>();
  readonly deleteRowIndex$ = new BehaviorSubject<number>(0);

  readonly INVALID_KEY = 'invalid';
  readonly formGroup = new FormGroup({
    title: new FormControl(''),
    key: new FormControl('', Validators.required),
    path: new FormControl('', Validators.required),
    dataType: new FormControl({
      key: this.INVALID_KEY,
    }),
    fieldType: new FormControl({
      key: this.INVALID_KEY,
    }),
  });
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
      propertyName: 'dataType',
      translationKey: 'dataType',
    },
    {
      viewType: 'string',
      sortable: false,
      propertyName: 'fieldType',
      translationKey: 'fieldType',
    },
  ];
  readonly DATA_TYPES: Array<SearchFieldDataType> = [
    'text',
    'number',
    'date',
    'datetime',
    'boolean',
  ];
  private readonly FIELD_TYPES: Array<SearchFieldFieldType> = ['single', 'range'];
  private cachedObjectManagementListSearchFields: Array<SearchField> = [];
  private readonly refreshObjectManagementListSearchFields$ = new BehaviorSubject<null>(null);

  readonly objectManagementFields$: Observable<Array<ListField>> = this.translateService
    .stream('key')
    .pipe(
      map(() =>
        this.COLUMNS.map(column => ({
          key: column.propertyName,
          label: this.translateService.instant(`searchFieldsOverview.${column.translationKey}`),
          sortable: column.sortable,
          ...(column.viewType && {viewType: column.viewType}),
        }))
      )
    );

  readonly objectId$: Observable<string> = this.route.params.pipe(
    map(params => params.id || ''),
    filter(objectId => !!objectId)
  );

  private readonly objectManagementListSearchFields$: Observable<Array<any>> = combineLatest([
    this.objectId$,
    this.refreshObjectManagementListSearchFields$,
  ]).pipe(
    switchMap(([objectId]) => this.objectManagementService.getSearchField(objectId)),
    tap(objectManagementListSearchFields => {
      this.objectId$.pipe(take(1)).subscribe(objectId => {
        if (
          objectManagementListSearchFields &&
          Array.isArray(objectManagementListSearchFields) &&
          objectManagementListSearchFields.length > 0
        ) {
          this.setDownload(objectId, objectManagementListSearchFields);
        }
      });
    }),
    tap(objectManagementListSearchFields => {
      this.cachedObjectManagementListSearchFields = objectManagementListSearchFields;
      this.loading$.next(false);
      this.enableInput();
    })
  );

  readonly translatedObjectManagementListSearchFields$: Observable<Array<SearchFieldColumnView>> =
    combineLatest([
      this.objectManagementListSearchFields$,
      this.translateService.stream('key'),
    ]).pipe(
      map(([columns]) =>
        columns.map(column => ({
          ...column,
          title: column.title || '-',
          dataType: this.translateService.instant(
            `searchFields.${column?.dataType?.toLowerCase()}`
          ),
          fieldType: this.translateService.instant(
            `searchFieldsOverview.${column?.fieldType?.toLowerCase()}`
          ),
        }))
      )
    );

  readonly selectedDataTypeItemIndex$ = new BehaviorSubject<number>(0);

  readonly dataTypeItems$: Observable<Array<ListItem>> = combineLatest([
    this.selectedDataTypeItemIndex$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([selectedDataTypeItemIndex]) =>
      [
        {
          content: this.translateService.instant(`searchFieldDataType.select`),
          key: this.INVALID_KEY,
        },
        ...this.DATA_TYPES.map(type => ({
          content: this.translateService.instant(`searchFields.${type}`),
          key: type.toUpperCase(),
        })),
      ].map((item, index) => ({
        ...item,
        selected: index === selectedDataTypeItemIndex,
      }))
    )
  );

  readonly selectedFieldTypeItemIndex$ = new BehaviorSubject<number>(0);
  readonly fieldTypeItems$: Observable<Array<ListItem>> = combineLatest([
    this.selectedFieldTypeItemIndex$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([selectedFieldTypeItemIndex]) =>
      [
        {
          content: this.translateService.instant(`searchFieldFieldType.select`),
          key: this.INVALID_KEY,
        },
        ...this.FIELD_TYPES.map(type => ({
          content: this.translateService.instant(`searchFieldsOverview.${type}`),
          key: type.toUpperCase(),
        })),
      ].map((item, index) => ({
        ...item,
        selected: index === selectedFieldTypeItemIndex,
      }))
    )
  );

  readonly validKey$ = combineLatest([this.formGroup.valueChanges, this.currentModalType$]).pipe(
    map(([formValues, currentModalType]) => {
      const existingKeys = this.cachedObjectManagementListSearchFields.map(column => column.key);
      return currentModalType === 'create' ? !existingKeys.includes(formValues.key) : true;
    }),
    startWith(false)
  );

  readonly valid$ = combineLatest([this.formGroup.valueChanges, this.validKey$]).pipe(
    map(([formValues, validKey]) => !!(formValues.path && validKey)),
    startWith(false)
  );

  constructor(
    private readonly objectManagementService: ObjectManagementService,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService,
    private readonly configService: ConfigService,
    private readonly sanitizer: DomSanitizer
  ) {}

  openModal(modalType: string): void {
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

  deleteRow(listSearchFieldRowIndex: number, clickEvent: MouseEvent): void {
    clickEvent.stopPropagation();

    this.showDeleteModal$.next(true);
    this.deleteRowIndex$.next(listSearchFieldRowIndex);
  }

  deleteRowConfirmation(listSearchFieldRowIndex: number): void {
    const columnKey = this.getColumnKey(listSearchFieldRowIndex);

    if (columnKey) {
      this.disableInput();

      this.objectId$
        .pipe(
          take(1),
          switchMap(objectId =>
            this.objectManagementService.deleteSearchField(objectId, columnKey)
          ),
          tap(() => this.refreshObjectManagementListSearchFields()),
          catchError(() => {
            this.enableInput();
            return of(null);
          })
        )
        .subscribe();
    }
  }

  getColumnKey(listSearchFieldRowIndex: number) {
    return this.cachedObjectManagementListSearchFields[listSearchFieldRowIndex]?.key;
  }

  moveRow(
    listSearchFieldRowIndex: number,
    moveUp: boolean,
    clickEvent: MouseEvent,
    objectId: string
  ): void {
    const objectManagementListSearchFields = [...this.cachedObjectManagementListSearchFields];
    const listSearchFieldRow = objectManagementListSearchFields[listSearchFieldRowIndex];

    clickEvent.stopPropagation();
    const listSearchFieldIndex = objectManagementListSearchFields.findIndex(
      field => field.key === listSearchFieldRow.key
    );
    const foundListSearchField = {...objectManagementListSearchFields[listSearchFieldIndex]};
    const filteredListSearchField = objectManagementListSearchFields.filter(
      field => field.key !== listSearchFieldRow.key
    );
    const multipleListSearchFields = objectManagementListSearchFields.length > 1;

    if (multipleListSearchFields && moveUp && listSearchFieldIndex > 0) {
      const listSearchFieldBeforeKey = `${
        objectManagementListSearchFields[listSearchFieldIndex - 1].key
      }`;
      const listSearchFieldBeforeIndex = filteredListSearchField.findIndex(
        field => field.key === listSearchFieldBeforeKey
      );
      filteredListSearchField.splice(listSearchFieldBeforeIndex, 0, foundListSearchField);
      this.updateObjectManagementListSearchField(objectId, filteredListSearchField);
    } else if (
      multipleListSearchFields &&
      !moveUp &&
      listSearchFieldIndex < objectManagementListSearchFields.length
    ) {
      const caseListColumnAfterKey = `${
        objectManagementListSearchFields[listSearchFieldIndex + 1].key
      }`;
      const caseListColumnAfterIndex = filteredListSearchField.findIndex(
        field => field.key === caseListColumnAfterKey
      );
      filteredListSearchField.splice(caseListColumnAfterIndex + 1, 0, foundListSearchField);
      this.updateObjectManagementListSearchField(objectId, filteredListSearchField);
    }
  }

  saveListSearchFields(): void {
    this.disableInput();

    this.currentModalType$.pipe(take(1)).subscribe(currentModalType => {
      if (currentModalType === 'create') {
        this.addSearchField();
      } else {
        this.updateSearchField();
      }
    });
  }

  columnRowClicked(row: {key: string}): void {
    this.resetFormGroup();

    combineLatest([this.dataTypeItems$, this.fieldTypeItems$])
      .pipe(take(1))
      .subscribe(([dataTypeItems, fieldTypeItems]) => {
        const column = this.cachedObjectManagementListSearchFields.find(
          cachedColumn => cachedColumn.key === row.key
        );
        const dataTypeItem = dataTypeItems.find(item => item.key === column.dataType);
        const dataTypeItemIndex = dataTypeItems.findIndex(item => item.key === column.dataType);

        const fieldTypeItem = fieldTypeItems.find(item => item.key === column.fieldType);
        const fieldTypeItemIndex = fieldTypeItems.findIndex(item => item.key === column.fieldType);

        this.selectedDataTypeItemIndex$.next(dataTypeItemIndex);
        this.selectedFieldTypeItemIndex$.next(fieldTypeItemIndex);

        this.formGroup.patchValue({
          key: column.key,
          title: column.title,
          path: column.path,
          // @ts-ignore
          dataType: {...dataTypeItem},
          // @ts-ignore
          fieldType: {...fieldTypeItem},
        });

        this.openModal('edit');
      });
  }

  private updateObjectManagementListSearchField(
    objectId: string,
    searchField: Array<SearchField>
  ): void {
    this.disableInput();
    this.objectManagementService
      .putSearchFields(objectId, searchField)
      .pipe(
        tap(() => {
          this.refreshObjectManagementListSearchFields();
          localStorage.setItem(`list-search-fields${objectId}`, null);
        }),
        catchError(() => {
          this.enableInput();
          return of(null);
        })
      )
      .subscribe();
  }

  private addSearchField(): void {
    const formValue = this.formGroup.value;

    this.objectId$
      .pipe(
        take(1),
        switchMap(objectId =>
          this.objectManagementService.postSearchField(
            objectId,
            this.mapFormValuesToColumn(formValue)
          )
        ),
        tap(() => {
          this.closeModal();
          this.refreshObjectManagementListSearchFields();
        }),
        catchError(() => {
          this.enableInput();
          return of(null);
        })
      )
      .subscribe();
  }

  private updateSearchField(): void {
    this.objectId$
      .pipe(
        take(1),
        switchMap(objectId =>
          this.objectManagementService.putSearchField(
            objectId,
            this.formGroup.value.key,
            this.mapFormValuesToColumn(this.formGroup.value)
          )
        ),
        tap(() => {
          this.closeModal();
          this.refreshObjectManagementListSearchFields();
        }),
        catchError(() => {
          this.enableInput();
          return of(null);
        })
      )
      .subscribe();
  }

  private setDownload(objectId: string, ObjectManagementSearchFields: Array<SearchField>): void {
    this.downloadName$.next(`${objectId}.json`);
    this.downloadUrl$.next(
      this.sanitizer.bypassSecurityTrustUrl(
        'data:text/json;charset=UTF-8,' +
          encodeURIComponent(JSON.stringify(ObjectManagementSearchFields, null, 2))
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

  private refreshObjectManagementListSearchFields(): void {
    this.refreshObjectManagementListSearchFields$.next(null);
  }

  private resetFormGroup(): void {
    this.formGroup.reset();
    this.selectedDataTypeItemIndex$.next(0);
    this.selectedFieldTypeItemIndex$.next(0);
  }

  private mapFormValuesToColumn(formValue: any): SearchField {
    return {
      key: formValue.key,
      title: formValue.title || '',
      path: formValue.path,
      dataType: formValue.dataType.key,
      fieldType: formValue.fieldType.key,
    };
  }
}
