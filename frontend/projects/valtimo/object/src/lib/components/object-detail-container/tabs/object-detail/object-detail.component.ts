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
import {Component, OnDestroy} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {BreadcrumbService} from '@valtimo/components';
import {GlobalNotificationService} from '@valtimo/shared';
import {ObjectManagementService} from '@valtimo/object-management';
import {BehaviorSubject, combineLatest, map, Observable, of, Subject, throwError} from 'rxjs';
import {catchError, finalize, switchMap, take, tap} from 'rxjs/operators';
import {FormType} from '../../../../models/object.model';
import {ObjectService} from '../../../../services/object.service';

@Component({
  standalone: false,
  selector: 'valtimo-object-detail',
  templateUrl: './object-detail.component.html',
  styleUrls: ['./object-detail.component.scss'],
})
export class ObjectDetailComponent implements OnDestroy {
  readonly loading$ = new BehaviorSubject<boolean>(true);
  readonly submission$ = new BehaviorSubject<any>({});
  readonly formValid$ = new BehaviorSubject<boolean>(false);
  readonly showModal$ = new BehaviorSubject<boolean>(false);
  readonly disableInput$ = new BehaviorSubject<boolean>(false);
  readonly showDeleteModal$ = new Subject<boolean>();
  readonly deleteObjectUrl$ = new BehaviorSubject<string>('');

  private readonly refreshObject$ = new BehaviorSubject<null>(null);

  readonly objectManagementId$: Observable<string> = this.route.params.pipe(
    map(params => params.objectManagementId),
    tap(objectManagementId => {
      if (!this._settingBreadcrumb && objectManagementId) {
        this._settingBreadcrumb = true;
        this.objectManagementService.getObjectById(objectManagementId).subscribe(objectType => {
          if (objectType.id && objectType.title) {
            this.setBreadcrumb(objectType.id, objectType.title);
          }
        });
      }
    })
  );
  readonly objectId$: Observable<string> = this.route.params.pipe(map(params => params.objectId));

  readonly formioFormSummary$: Observable<any> = combineLatest([
    this.objectManagementId$,
    this.objectId$,
    this.refreshObject$,
  ]).pipe(
    switchMap(([objectManagementId, objectId]) =>
      this.objectService
        .getPrefilledObjectFromObjectUrl({objectManagementId, objectId, formType: FormType.SUMMARY})
        .pipe(catchError(() => this.handleRetrievingFormError()))
    ),
    map(res => res?.formDefinition),
    tap(() => this.loading$.next(false))
  );

  readonly formioFormEdit$: Observable<any> = combineLatest([
    this.objectManagementId$,
    this.objectId$,
    this.refreshObject$,
  ]).pipe(
    switchMap(([objectManagementId, objectId]) =>
      this.objectService
        .getPrefilledObjectFromObjectUrl({
          objectManagementId,
          objectId,
          formType: FormType.EDITFORM,
        })
        .pipe(
          catchError(() => {
            this.disableInput();
            return this.handleRetrievingFormError();
          })
        )
    ),
    map(res => res?.formDefinition),
    tap(() => this.loading$.next(false))
  );

  private _settingBreadcrumb = false;

  constructor(
    private readonly breadcrumbService: BreadcrumbService,
    private readonly globalNotificationService: GlobalNotificationService,
    private readonly objectManagementService: ObjectManagementService,
    private readonly objectService: ObjectService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly translate: TranslateService
  ) {}

  public ngOnDestroy(): void {
    this.breadcrumbService.clearSecondBreadcrumb();
  }

  saveObject(): void {
    this.disableInput();

    this.updateObject();
  }

  deleteObject(): void {
    this.showDeleteModal$.next(true);
  }

  deleteObjectConfirmation(): void {
    this.disableInput();
    combineLatest([this.objectManagementId$, this.objectId$])
      .pipe(take(1))
      .subscribe(([objectManagementId, objectId]) => {
        this.objectService
          .deleteObject({objectManagementId, objectId})
          .pipe(
            take(1),
            catchError((error: any) => this.handleDeleteObjectError(error)),
            finalize(() => {
              this.enableInput();
            })
          )
          .subscribe(() => {
            this.closeModal();
            this.globalNotificationService.showToast({
              title: this.translate.instant('object.messages.objectDeleted'),
              type: 'success',
            });
            this.router.navigate([`/objects/${objectManagementId}`]);
          });
      });
  }

  openModal(): void {
    this.showModal$.next(true);
    this.enableInput();
  }

  onFormioChange(formio): void {
    if (formio.data != null) {
      this.submission$.next(formio.data);
      this.formValid$.next(formio.isValid);
    }
  }

  closeModal(): void {
    this.showModal$.next(false);
  }

  private updateObject(): void {
    this.disableInput();
    combineLatest([this.objectManagementId$, this.objectId$, this.submission$, this.formValid$])
      .pipe(take(1))
      .subscribe(([objectManagementId, objectId, submission, formValid]) => {
        if (formValid) {
          submission = this.objectService.removeEmptyStringValuesFromSubmission(submission);
          this.objectService
            .updateObject({objectManagementId, objectId}, {...submission})
            .pipe(
              take(1),
              catchError((error: any) => this.handleUpdateObjectError(error)),
              finalize(() => {
                this.enableInput();
              })
            )
            .subscribe(() => {
              this.closeModal();
              this.refreshObject();
              this.globalNotificationService.showToast({
                title: this.translate.instant('object.messages.objectUpdated'),
                type: 'success',
              });
            });
        }
      });
  }

  private refreshObject(): void {
    this.refreshObject$.next(null);
  }

  private disableInput(): void {
    this.disableInput$.next(true);
  }

  private enableInput(): void {
    this.disableInput$.next(false);
  }

  private handleRetrievingFormError() {
    this.globalNotificationService.showToast({
      title: this.translate.instant('object.messages.objectRetrievingFormError'),
      type: 'error',
    });
    this.loading$.next(false);
    return of(null);
  }

  private handleUpdateObjectError(error: any) {
    this.closeModal();
    this.globalNotificationService.showToast({
      title: this.translate.instant('object.messages.objectUpdateError'),
      type: 'error',
    });
    return throwError(error);
  }

  private handleDeleteObjectError(error: any) {
    this.closeModal();
    this.globalNotificationService.showToast({
      title: this.translate.instant('object.messages.objectDeleteError'),
      type: 'error',
    });
    return throwError(error);
  }

  private setBreadcrumb(objectTypeId: string, title: string): void {
    this.breadcrumbService.setSecondBreadcrumb({
      route: [`/objects/${objectTypeId}`],
      content: title,
      href: `/objects/${objectTypeId}`,
    });
  }
}
