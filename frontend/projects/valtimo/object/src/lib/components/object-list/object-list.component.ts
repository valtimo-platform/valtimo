/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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
import {BehaviorSubject, combineLatest, map, Observable, of, startWith, throwError} from 'rxjs';
import {catchError, finalize, switchMap, take, tap} from 'rxjs/operators';
import {TranslateService} from '@ngx-translate/core';
import {ActivatedRoute, Router} from '@angular/router';
import {ObjectService} from '../../services/object.service';
import {Pagination} from '@valtimo/components';
import {FormType} from '../../models/object.model';
import {ToastrService} from 'ngx-toastr';

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

  readonly fields$ = new BehaviorSubject<Array<{key: string; label: string}>>([]);
  readonly objectManagementId$: Observable<string> = this.route.params.pipe(
    map(params => params.objectManagementId)
  );

  private readonly refreshObjectList$ = new BehaviorSubject<null>(null);

  readonly currentPageAndSize$ = new BehaviorSubject<Partial<Pagination>>({
    page: 0,
    size: 10,
  });

  readonly pageSizes$ = new BehaviorSubject<Partial<Pagination>>({
    collectionSize: 0,
    maxPaginationItemSize: 5,
  });

  readonly pagination$: Observable<Pagination> = combineLatest([
    this.currentPageAndSize$,
    this.pageSizes$,
  ]).pipe(
    map(
      ([currentPage, sizes]) =>
        ({...currentPage, ...sizes, page: currentPage.page + 1} as Pagination)
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

  readonly objectConfiguration$: Observable<Array<any>> = combineLatest([
    this.objectManagementId$,
    this.currentPageAndSize$,
    this.translateService.stream('key'),
    this.refreshObjectList$,
  ]).pipe(
    tap(() => {
      this.setFields();
    }),
    switchMap(([objectManagementId, currentPage]) =>
      this.objectService.getObjectsByObjectManagementId(objectManagementId, {
        page: currentPage.page,
        size: currentPage.size,
      })
    ),
    tap(instanceRes => {
      this.pageSizes$.pipe(take(1)).subscribe(sizes => {
        // @ts-ignore
        this.pageSizes$.next({...sizes, collectionSize: instanceRes.totalElements});
      });
    }),
    map(res => res.content.map(record => ({
        objectUrl: record.items[0].value,
        recordIndex: record.items[1].value,
      }))),
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

  constructor(
    private readonly objectService: ObjectService,
    private readonly translateService: TranslateService,
    private router: Router,
    private route: ActivatedRoute,
    private toastr: ToastrService,
    private translate: TranslateService
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

  addObject(): void {
    this.disableInput();
    combineLatest([this.objectManagementId$, this.submission$, this.formValid$])
      .pipe(take(1))
      .subscribe(([objectManagementId, submission, formValid]) => {
        if (formValid) {
          submission = this.objectService.removeEmptyStringValuesFromSubmission(submission);
          this.objectService
            .createObject({objectManagementId}, {...submission})
            .pipe(
              take(1),
              catchError((error: any) => this.handleCreateObjectError(error)),
              finalize(() => {
                this.enableInput();
              })
            )
            .subscribe(() => {
              this.closeModal();
              this.refreshObjectList();
              this.clearForm$.next(true);
              this.toastr.success(this.translate.instant('object.messages.objectCreated'));
            });
        }
      });
  }

  redirectToDetails(record): void {
    const objectId = record.objectUrl.split('/').pop();
    this.objectManagementId$.pipe(take(1)).subscribe(configurationId => {
      this.router.navigate([`/objects/${configurationId}/${objectId}`]);
    });
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

  private setFields(): void {
    const keys: Array<string> = ['recordIndex', 'objectUrl'];
    this.fields$.next(
      keys.map(key => ({label: `${this.translateService.instant(`object.labels.${key}`)}`, key}))
    );
  }

  private handleRetrievingFormError(error: any) {
    this.toastr.error(this.translate.instant('object.messages.objectRetrievingFormError'));
    return throwError(error);
  }

  private handleCreateObjectError(error: any) {
    this.closeModal();
    this.toastr.error(this.translate.instant('object.messages.objectCreationError'));
    return throwError(error);
  }
}
