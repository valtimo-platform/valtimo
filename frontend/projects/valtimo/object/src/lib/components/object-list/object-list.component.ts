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

import {Component} from '@angular/core';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  of,
  startWith,
  throwError,
} from 'rxjs';
import {catchError, finalize, switchMap, take, tap} from 'rxjs/operators';
import {TranslateService} from '@ngx-translate/core';
import {ActivatedRoute, Router} from '@angular/router';
import {ObjectService} from '../../services/object.service';
import {ListField, PageTitleService, Pagination} from '@valtimo/components';
import {ColumnType, FormType} from '../../models/object.model';
import {ToastrService} from 'ngx-toastr';
import {ObjectColumnService} from '../../services/object-column.service';
import {ObjectManagementService, SearchColumn} from '@valtimo/object-management';
import {SearchField, SearchFieldValues, SearchFilter, SearchFilterRange} from '@valtimo/config';

@Component({
  selector: 'valtimo-object-list',
  templateUrl: './object-list.component.html',
  styleUrls: ['./object-list.component.scss'],
})
export class ObjectListComponent {
  readonly loading$ = new BehaviorSubject<boolean>(true);
  readonly submission$ = new BehaviorSubject<any>({});
  readonly formValid$ = new BehaviorSubject<boolean>(false);
  readonly showModal$ = new BehaviorSubject<boolean>(false);
  readonly disableInput$ = new BehaviorSubject<boolean>(false);
  readonly clearForm$ = new BehaviorSubject<boolean>(false);
  readonly columnType$ = new BehaviorSubject<ColumnType>(ColumnType.DEFAULT);

  readonly objectManagementId$: Observable<string> = this.route.params.pipe(
    map(params => params.objectManagementId),
    tap(objectManagementId => {
      if (objectManagementId) {
        this.objectManagementService.getObjectById(objectManagementId).subscribe(objectType => {
          if (objectType.title) {
            this.pageTitleService.setCustomPageTitle(objectType.title);
          }
        });
      }
    })
  );

  private readonly refreshObjectList$ = new BehaviorSubject<null>(null);

  readonly currentPageAndSize$ = new BehaviorSubject<Partial<Pagination>>({
    page: 0,
    size: 10,
  });

  readonly pageSizes$ = new BehaviorSubject<Partial<Pagination>>({
    collectionSize: 0,
  });

  readonly pagination$: Observable<Pagination> = combineLatest([
    this.currentPageAndSize$,
    this.pageSizes$,
  ]).pipe(
    map(
      ([currentPage, sizes]) =>
        ({...currentPage, ...sizes, page: currentPage.page + 1}) as Pagination
    )
  );

  paginationClicked(newPageNumber): void {
    this.currentPageAndSize$.pipe(take(1)).subscribe(currentPage => {
      this.currentPageAndSize$.next({...currentPage, page: newPageNumber - 1});
    });
  }

  paginationSet(newPageSize): void {
    if (newPageSize) {
      this.currentPageAndSize$.pipe(take(1)).subscribe(currentPage => {
        this.currentPageAndSize$.next({...currentPage, size: newPageSize});
      });
    }
  }

  private readonly searchFieldValues$ = new BehaviorSubject<SearchFieldValues>({});
  readonly objectSearchFields$: Observable<Array<SearchField> | null> =
    this.objectManagementId$.pipe(
      distinctUntilChanged(),
      switchMap(objectManagementId =>
        this.objectManagementService.getSearchField(objectManagementId)
      ),
      map(searchFields =>
        searchFields.map(searchField => {
          // @ts-ignore
          searchField.dataType = searchField.dataType.toLowerCase();
          // @ts-ignore
          searchField.fieldType = searchField.fieldType.toLowerCase();
          return searchField;
        })
      )
    );

  readonly objectConfiguration$: Observable<Array<any>> = combineLatest([
    this.objectManagementId$,
    this.currentPageAndSize$,
    this.columnType$,
    this.searchFieldValues$,
    this.translateService.stream('key'),
    this.refreshObjectList$,
  ]).pipe(
    switchMap(([objectManagementId, currentPage, columnType, searchFieldValues]) => {
      const handleError = () => {
        this.disableInput();
        return of(null);
      };

      if (columnType === ColumnType.CUSTOM) {
        return this.objectService
          .postObjectsByObjectManagementId(
            objectManagementId,
            {
              page: currentPage.page,
              size: currentPage.size,
            },
            Object.keys(searchFieldValues).length > 0
              ? {otherFilters: this.mapSearchValuesToFilters(searchFieldValues)}
              : {}
          )
          .pipe(catchError(() => handleError()));
      }

      return this.objectService
        .getObjectsByObjectManagementId(objectManagementId, {
          page: currentPage.page,
          size: currentPage.size,
        })
        .pipe(catchError(() => handleError()));
    }),
    tap(instanceRes => {
      if (instanceRes != null) {
        this.pageSizes$.pipe(take(1)).subscribe(sizes => {
          // @ts-ignore
          this.pageSizes$.next({...sizes, collectionSize: instanceRes.totalElements});
        });
      }
    }),
    map(res =>
      res?.content?.map(record =>
        record?.items?.reduce(
          (obj, item) => Object.assign(obj, {objectId: record.id}, {[item.key]: item.value}),
          {}
        )
      )
    ),
    tap(() => this.loading$.next(false))
  );

  readonly formDefinition$: Observable<any> = combineLatest([
    this.objectManagementId$,
    this.clearForm$,
  ]).pipe(
    switchMap(([objectManagementId]) =>
      this.objectService
        .getPrefilledObjectFromObjectUrl({objectManagementId, formType: FormType.EDITFORM})
        .pipe(
          catchError(error => {
            this.handleRetrievingFormError(error);
            this.disableInput();
            return of(null).pipe(startWith(null));
          })
        )
    ),
    map(res => {
      if (res != null) {
        this.enableInput();
      }

      return res?.formDefinition;
    }),
    startWith(null),
    finalize(() => this.loading$.next(false))
  );

  private readonly columns$: Observable<Array<SearchColumn>> = this.objectManagementId$.pipe(
    switchMap(objectManagementId => this.objectColumnService.getObjectColumns(objectManagementId)),
    map(res => res)
  );

  readonly fields$: Observable<Array<ListField>> = combineLatest([
    this.columns$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([columns]) => {
      if (columns?.length > 0) {
        this.columnType$.next(ColumnType.CUSTOM);

        return [
          ...columns.map(column => {
            const translationKey = `fieldLabels.${column.translationKey}`;
            const translation = this.translateService.instant(translationKey);
            const validTranslation = translation !== translationKey && translation;
            return {
              key: column.translationKey,
              label: column.title || validTranslation || column.translationKey,
              sortable: column.sortable,
              ...(column.viewType && {viewType: column.viewType || ''}),
              ...(column.enum && {enum: column.enum}),
              ...(column.format && {format: column.format}),
            };
          }),
        ];
      }

      this.columnType$.next(ColumnType.DEFAULT);
      return this.setDefaultFields();
    })
  );

  constructor(
    private readonly objectService: ObjectService,
    private readonly objectColumnService: ObjectColumnService,
    private readonly objectManagementService: ObjectManagementService,
    private readonly translateService: TranslateService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly toastr: ToastrService,
    private readonly translate: TranslateService,
    private readonly pageTitleService: PageTitleService
  ) {}

  openModal(): void {
    this.showModal$.next(true);
  }

  closeModal(): void {
    this.showModal$.next(false);
    this.clearForm$.next(true);
  }

  onFormioChange(formio): void {
    if (formio.data != null) {
      this.submission$.next(formio.data);
      this.formValid$.next(formio.isValid);
    }
  }

  public addObject(): void {
    this.disableInput();
    combineLatest([this.objectManagementId$, this.submission$, this.formValid$])
      .pipe(
        take(1),
        filter(([objectManagementId, submission, formValid]) => formValid),
        switchMap(([objectManagementId, submission]) =>
          this.objectService
            .createObject(
              {objectManagementId},
              {...this.objectService.removeEmptyStringValuesFromSubmission(submission)}
            )
            .pipe(
              take(1),
              catchError((error: any) => {
                this.handleCreateObjectError(error);
                return throwError(error);
              })
            )
        ),
        finalize(() => {
          this.enableInput();
        })
      )
      .subscribe({
        next: () => {
          this.closeModal();
          this.refreshObjectList();
          this.clearForm$.next(true);
          this.toastr.success(this.translate.instant('object.messages.objectCreated'));
        },
      });
  }

  redirectToDetails(record): void {
    const objectId = record.objectUrl ? record.objectUrl.split('/').pop() : record.objectId;
    this.objectManagementId$.pipe(take(1)).subscribe(configurationId => {
      this.router.navigate([`/objects/${configurationId}/${objectId}`]);
    });
  }

  search(searchFieldValues: SearchFieldValues): void {
    this.searchFieldValues$.next(searchFieldValues || {});
  }

  private refreshObjectList(): void {
    this.refreshObjectList$.next(null);
  }

  private disableInput(): void {
    this.disableInput$.next(true);
  }

  private enableInput(): void {
    this.disableInput$.next(false);
  }

  private setDefaultFields() {
    const keys: Array<string> = ['recordIndex', 'objectUrl'];
    return keys.map(key => ({
      label: `${this.translateService.instant(`object.labels.${key}`)}`,
      key,
      sortable: false,
      type: 'string',
    }));
  }

  private handleRetrievingFormError(error: any) {
    this.toastr.error(this.translate.instant('object.messages.objectRetrievingFormError'));
    return throwError(error);
  }

  private handleCreateObjectError(error: any) {
    this.toastr.error(this.translate.instant('object.messages.objectCreationError'));
    return throwError(error);
  }

  private mapSearchValuesToFilters(
    values: SearchFieldValues
  ): Array<SearchFilter | SearchFilterRange> {
    const filters: Array<SearchFilter | SearchFilterRange> = [];

    Object.keys(values).forEach(valueKey => {
      const searchValue = values[valueKey] as any;
      if (searchValue.start) {
        filters.push({key: valueKey, rangeFrom: searchValue.start, rangeTo: searchValue.end});
      } else if (Array.isArray(searchValue)) {
        filters.push({key: valueKey, values: searchValue});
      } else {
        // @ts-ignore
        filters.push({key: valueKey, values: [searchValue]});
      }
    });

    return filters;
  }
}
