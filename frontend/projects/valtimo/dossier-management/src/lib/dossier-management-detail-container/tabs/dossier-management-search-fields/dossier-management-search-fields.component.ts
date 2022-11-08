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
import {Component} from '@angular/core';
import {DocumentService} from '@valtimo/document';
import {BehaviorSubject, combineLatest, filter, map, Observable, switchMap, take, tap} from 'rxjs';
import {ActivatedRoute} from '@angular/router';
import {ListField} from '@valtimo/components';
import {TranslateService} from '@ngx-translate/core';
import {DefinitionColumn, SearchField} from '@valtimo/config';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';

@Component({
  selector: 'valtimo-dossier-management-search-fields',
  templateUrl: './dossier-management-search-fields.component.html',
  styleUrls: ['./dossier-management-search-fields.component.scss'],
})
export class DossierManagementSearchFieldsComponent {
  private readonly COLUMNS: Array<DefinitionColumn> = [
    {
      viewType: 'string',
      sortable: false,
      propertyName: 'path',
      translationKey: 'path',
    },
    {
      viewType: 'string',
      sortable: false,
      propertyName: 'datatype',
      translationKey: 'datatype',
    },
    {
      viewType: 'string',
      sortable: false,
      propertyName: 'fieldtype',
      translationKey: 'fieldtype',
    },
    {
      viewType: 'string',
      sortable: false,
      propertyName: 'matchtype',
      translationKey: 'matchtype',
    },
  ];

  readonly fields$: Observable<Array<ListField>> = this.translateService.stream('key').pipe(
    map(() =>
      this.COLUMNS.map(column => ({
        key: column.propertyName,
        label: this.translateService.instant(`searchFieldsOverview.${column.translationKey}`),
        sortable: column.sortable,
        ...(column.viewType && {viewType: column.viewType}),
      }))
    )
  );

  private readonly documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params.name || ''),
    filter(docDefName => !!docDefName)
  );

  private readonly searchFields$: Observable<Array<SearchField>> =
    this.documentDefinitionName$.pipe(
      switchMap(documentDefinitionName =>
        this.documentService.getDocumentSearchFields(documentDefinitionName)
      ),
      tap(searchFields => {
        this.documentDefinitionName$.pipe(take(1)).subscribe(documentDefinitionName => {
          this.setDownload(documentDefinitionName, searchFields);
        });
      })
    );

  readonly translatedSearchFields$: Observable<Array<SearchField>> = combineLatest([
    this.searchFields$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([searchFields]) =>
      searchFields.map(searchField => ({
        ...searchField,
        datatype: this.translateService.instant(`searchFields.${searchField.datatype}`),
        matchtype: this.translateService.instant(`searchFieldsOverview.${searchField.matchtype}`),
        fieldtype: this.translateService.instant(`searchFieldsOverview.${searchField.fieldtype}`),
      }))
    )
  );

  readonly downloadName$ = new BehaviorSubject<string>('');
  readonly downloadUrl$ = new BehaviorSubject<SafeUrl>(undefined);

  constructor(
    private readonly documentService: DocumentService,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService,
    private readonly sanitizer: DomSanitizer
  ) {}

  private setDownload(documentDefinitionName: string, searchFields: Array<SearchField>): void {
    this.downloadName$.next(`${documentDefinitionName}.json`);
    this.downloadUrl$.next(
      this.sanitizer.bypassSecurityTrustUrl(
        'data:text/json;charset=UTF-8,' +
          encodeURIComponent(JSON.stringify({searchFields}, null, 2))
      )
    );
  }
}
