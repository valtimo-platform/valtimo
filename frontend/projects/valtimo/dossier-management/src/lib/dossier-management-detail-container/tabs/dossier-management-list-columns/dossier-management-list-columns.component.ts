/*
 * Copyright 2015-2022 Ritense BV, the Netherlands.
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
import {ListField} from '@valtimo/components';
import {ConfigService, DefinitionColumn} from '@valtimo/config';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import {
  CaseListColumn,
  CaseListColumnView,
  DisplayTypeParameters,
  DocumentService,
} from '@valtimo/document';
import {ActivatedRoute} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {ListColumnModal} from '../../../models';
import {FormControl, FormGroup, Validators} from '@angular/forms';
import {ListItem} from 'carbon-components-angular/dropdown/list-item.interface';
import {take} from 'rxjs/operators';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';

@Component({
  selector: 'valtimo-dossier-management-list-columns',
  templateUrl: './dossier-management-list-columns.component.html',
  styleUrls: ['./dossier-management-list-columns.component.scss'],
})
export class DossierManagementListColumnsComponent {
  @ViewChild('moveRowButtons') public moveRowButtonsTemplateRef: TemplateRef<any>;
  readonly downloadName$ = new BehaviorSubject<string>('');
  readonly downloadUrl$ = new BehaviorSubject<SafeUrl>(undefined);

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

  loadingCaseListColumns = true;

  readonly fields$: Observable<Array<ListField>> = this.translateService.stream('key').pipe(
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

  readonly documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params.name || ''),
    filter(docDefName => !!docDefName)
  );

  readonly disableInput$ = new BehaviorSubject<boolean>(false);

  readonly hasEnvironmentConfig$: Observable<boolean> = this.documentDefinitionName$.pipe(
    map(
      documentDefinitionName =>
        !!this.configService?.config?.customDefinitionTables[documentDefinitionName]
    )
  );

  private cachedCaseListColumns: Array<CaseListColumn> = [];

  private readonly refreshCaseListcolumns$ = new BehaviorSubject<null>(null);

  private readonly caseListColumns$: Observable<Array<CaseListColumn>> = combineLatest([
    this.documentDefinitionName$,
    this.refreshCaseListcolumns$,
  ]).pipe(
    switchMap(([documentDefinitionName]) =>
      this.documentService.getCaseList(documentDefinitionName)
    ),
    tap(caseListColumns => {
      this.documentDefinitionName$.pipe(take(1)).subscribe(documentDefinitionName => {
        if (caseListColumns && Array.isArray(caseListColumns) && caseListColumns.length > 0) {
          this.setDownload(documentDefinitionName, caseListColumns);
        }
      });
    }),
    tap(caseListColumns => {
      this.cachedCaseListColumns = caseListColumns;
      this.loadingCaseListColumns = false;
      this.enableInput();
    })
  );

  readonly translatedCaseListColumns$: Observable<Array<CaseListColumnView>> = combineLatest([
    this.caseListColumns$,
    this.translateService.stream('key'),
  ]).pipe(
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

  readonly currentModalType$ = new BehaviorSubject<ListColumnModal>('create');

  readonly showModal$ = new BehaviorSubject<boolean>(false);

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

  readonly hasDefaultSort$ = this.formGroup.valueChanges.pipe(
    map(() => this.cachedCaseListColumns.find(column => !!column.defaultSort)),
    startWith(false)
  );

  readonly DISPLAY_TYPES: Array<string> = [
    'string',
    'date',
    'boolean',
    'enum',
    'arrayCount',
    'underscoresToSpaces',
  ];

  readonly showDateFormat$ = this.formGroup.valueChanges.pipe(
    map(formValues => !!(formValues.displayType?.key === this.DISPLAY_TYPES[1])),
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
    map(formValues => !!(formValues.displayType?.key === this.DISPLAY_TYPES[2]))
  );

  readonly viewTypeItems$: Observable<Array<ListItem>> = this.translateService.stream('key').pipe(
    map(() => [
      {
        content: this.translateService.instant(`listColumnDisplayType.select`),
        key: this.INVALID_KEY,
        selected: true,
      },
      ...this.DISPLAY_TYPES.map(type => ({
        content: this.translateService.instant(`listColumnDisplayType.${type}`),
        key: type,
        selected: false,
      })),
    ])
  );

  readonly sortItems$: Observable<Array<ListItem>> = this.translateService.stream('key').pipe(
    map(() => [
      {
        content: this.translateService.instant(`listColumn.selectDefaultSort`),
        key: this.INVALID_KEY,
        selected: true,
      },
      {
        content: this.translateService.instant(`listColumn.sortableAsc`),
        key: 'ASC',
        selected: false,
      },
      {
        content: this.translateService.instant(`listColumn.sortableDesc`),
        key: 'DESC',
        selected: false,
      },
    ])
  );

  readonly validKey$ = this.formGroup.valueChanges.pipe(
    map(formValues => {
      const existingKeys = this.cachedCaseListColumns.map(column => column.key);
      return !existingKeys.includes(formValues.key);
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
    private readonly documentService: DocumentService,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService,
    private readonly configService: ConfigService,
    private readonly sanitizer: DomSanitizer
  ) {}
  openModal(modalType: ListColumnModal): void {
    this.showModal$.next(true);
    this.currentModalType$.next(modalType);

    if (modalType === 'create') {
      this.resetFormGroup();
    }
  }

  closeModal(): void {
    this.showModal$.next(false);
  }

  moveRow(
    caseListColumnRowIndex: number,
    moveUp: boolean,
    clickEvent: MouseEvent,
    documentDefinitionName: string
  ): void {
    const caseListColumns = [...this.cachedCaseListColumns];
    const caseListColumnRow = caseListColumns[caseListColumnRowIndex];

    clickEvent.stopPropagation();

    const caseListColumnIndex = caseListColumns.findIndex(
      field => field.key === caseListColumnRow.key
    );
    const foundCaseListColumn = {...caseListColumns[caseListColumnIndex]};
    const filteredCaseListColumns = caseListColumns.filter(
      field => field.key !== caseListColumnRow.key
    );
    const multipleCaseListColumns = caseListColumns.length > 1;

    if (multipleCaseListColumns && moveUp && caseListColumnIndex > 0) {
      const caseListColumnBeforeKey = `${caseListColumns[caseListColumnIndex - 1].key}`;
      const caseListColumnBeforeIndex = filteredCaseListColumns.findIndex(
        field => field.key === caseListColumnBeforeKey
      );
      filteredCaseListColumns.splice(caseListColumnBeforeIndex, 0, foundCaseListColumn);
      this.updateCaseListColumns(documentDefinitionName, filteredCaseListColumns);
    } else if (multipleCaseListColumns && !moveUp && caseListColumnIndex < caseListColumns.length) {
      const caseListColumnAfterKey = `${caseListColumns[caseListColumnIndex + 1].key}`;
      const caseListColumnAfterIndex = filteredCaseListColumns.findIndex(
        field => field.key === caseListColumnAfterKey
      );
      filteredCaseListColumns.splice(caseListColumnAfterIndex + 1, 0, foundCaseListColumn);
      this.updateCaseListColumns(documentDefinitionName, filteredCaseListColumns);
    }
  }

  saveCasListColumns(): void {
    const formValue = this.formGroup.value;

    this.disableInput();

    this.documentDefinitionName$.pipe(take(1)).subscribe(docDefName => {
      this.documentService
        .postCaseList(docDefName, {
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
                  enum: formValue.enum.reduce(
                    (acc, curr) => ({...acc, [curr.key]: curr.value}),
                    {}
                  ),
                }),
            },
          },
        })
        .subscribe(
          () => {
            this.closeModal();
            this.refreshCaseListColumns();
          },
          () => {
            this.enableInput();
          }
        );
    });
  }

  enumValueChange(value: Array<{[key: string]: string}>): void {
    this.formGroup.patchValue({enum: value});
  }

  private updateCaseListColumns(
    documentDefinitionName: string,
    newCaseListColumns: Array<CaseListColumn>
  ): void {
    this.disableInput();

    this.documentService.putCaseList(documentDefinitionName, newCaseListColumns).subscribe(
      () => {
        this.refreshCaseListColumns();
        localStorage.setItem(`list-search-${documentDefinitionName}`, null);
      },
      () => {
        this.enableInput();
      }
    );
  }

  private getDisplayTypeParametersView(displayTypeParameters: DisplayTypeParameters): string {
    if (displayTypeParameters?.dateFormat) {
      return displayTypeParameters.dateFormat;
    } else if (displayTypeParameters?.enum) {
      return Object.keys(displayTypeParameters.enum).reduce((acc, curr) => {
        const keyValuePairString = `${curr}: ${displayTypeParameters.enum[curr]}`;
        if (!acc) {
          return `${keyValuePairString}`;
        } else {
          return `${acc}, ${keyValuePairString}`;
        }
      }, '');
    } else {
      return '-';
    }
  }

  private setDownload(
    documentDefinitionName: string,
    caseListColumns: Array<CaseListColumn>
  ): void {
    this.downloadName$.next(`${documentDefinitionName}.json`);
    this.downloadUrl$.next(
      this.sanitizer.bypassSecurityTrustUrl(
        'data:text/json;charset=UTF-8,' +
          encodeURIComponent(JSON.stringify(caseListColumns, null, 2))
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

  private refreshCaseListColumns(): void {
    this.refreshCaseListcolumns$.next(null);
  }

  private resetFormGroup(): void {
    this.formGroup.reset();
    combineLatest([this.sortItems$, this.viewTypeItems$])
      .pipe(take(1))
      .subscribe(([sortItems, viewTypeItems]) => {
        // @ts-ignore
        this.formGroup.patchValue({displayType: viewTypeItems[0]});
        // @ts-ignore
        this.formGroup.patchValue({defaultSort: sortItems[0]});
      });
  }
}
