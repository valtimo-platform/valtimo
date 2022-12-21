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
import {BehaviorSubject, combineLatest, filter, map, Observable, switchMap, tap} from 'rxjs';
import {
  CaseListColumn,
  CaseListColumnView,
  DisplayTypeParameters,
  DocumentService,
} from '@valtimo/document';
import {ActivatedRoute} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';

@Component({
  selector: 'valtimo-dossier-management-list-columns',
  templateUrl: './dossier-management-list-columns.component.html',
  styleUrls: ['./dossier-management-list-columns.component.scss'],
})
export class DossierManagementListColumnsComponent {
  @ViewChild('moveRowButtons') public moveRowButtonsTemplateRef: TemplateRef<any>;

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

  constructor(
    private readonly documentService: DocumentService,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService,
    private readonly configService: ConfigService
  ) {}

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

  private updateCaseListColumns(
    documentDefinitionName: string,
    newCaseListColumns: Array<CaseListColumn>
  ): void {
    this.disableInput();

    this.documentService.putCaseList(documentDefinitionName, newCaseListColumns).subscribe(
      () => {
        this.refreshCaseListColumns();
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

  private disableInput(): void {
    this.disableInput$.next(true);
  }

  private enableInput(): void {
    this.disableInput$.next(false);
  }

  private refreshCaseListColumns(): void {
    this.refreshCaseListcolumns$.next(null);
  }
}
