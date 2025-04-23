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

import {AfterViewInit, Component, TemplateRef, ViewChild} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {IconService, Notification} from 'carbon-components-angular';
import {Return16, Save16, TrashCan16} from '@carbon/icons';
import {BehaviorSubject, combineLatest, map, Observable, switchMap} from 'rxjs';
import {ActivatedRoute, Router} from '@angular/router';
import {CaseManagementService} from '../../services';
import {take, tap} from 'rxjs/operators';
import {CaseDefinition} from '../../models/case-deployment.model';
import {BreadcrumbService} from '@valtimo/components';
import {DatePipe} from '@angular/common';
import {GlobalNotificationService} from '@valtimo/layout';

@Component({
  templateUrl: './case-management-deployment.component.html',
  styleUrls: ['./case-management-deployment.component.scss'],
})
export class CaseManagementDeploymentComponent implements AfterViewInit {
  @ViewChild('draftMessage')
  private readonly _draftMessageTemplateRef: TemplateRef<HTMLDivElement>;
  public readonly isDraftVersion$ = new BehaviorSubject<boolean>(false);
  public readonly hasConflictingVersions$ = new BehaviorSubject<boolean>(false);
  public readonly showDeleteDraftConfirmationModal$ = new BehaviorSubject<boolean>(false);
  public readonly showFinalizeDraftConfirmationModal$ = new BehaviorSubject<boolean>(false);
  public readonly params$: Observable<{
    caseDefinitionKey: string;
    caseDefinitionVersionTag: string;
  }> = this.route.params.pipe(
    map(({caseDefinitionKey, caseDefinitionVersionTag}) => ({
      caseDefinitionKey: caseDefinitionKey,
      caseDefinitionVersionTag: caseDefinitionVersionTag,
    }))
  );

  public readonly caseDefinitionKey$: Observable<string> = this.params$.pipe(
    map(params => params.caseDefinitionKey || '')
  );

  public readonly caseDefinitionVersionTag$: Observable<string> = this.params$.pipe(
    map(params => params.caseDefinitionVersionTag || '')
  );

  public readonly _globalActiveCase$: Observable<any> = this.caseDefinitionKey$.pipe(
    switchMap(caseDefinitionKey =>
      this.caseManagementService.getGlobalActiveCase(caseDefinitionKey)
    )
  );

  public readonly _caseDefinitionTitle$: Observable<string> = this._globalActiveCase$.pipe(
    map(result => result.name)
  );

  public readonly caseDefinition$: Observable<CaseDefinition> = combineLatest([
    this.caseDefinitionKey$,
    this.caseDefinitionVersionTag$,
  ]).pipe(
    switchMap(([caseDefinitionKey, caseDefinitionVersionTag]) =>
      this.caseManagementService.getCaseDefinition(caseDefinitionKey, caseDefinitionVersionTag)
    ),
    tap(caseDefinition => {
      this.isDraftVersion$.next(!caseDefinition.final);
      this.hasConflictingVersions$.next(!!caseDefinition.conflictingVersions);
    })
  );

  public readonly releaseVersionEntries$: Observable<{key: string; value: string}[]> =
    this.caseDefinition$.pipe(
      map(caseDefinition => {
        const releaseVersionData = {
          caseDefinitionVersionTag: caseDefinition.caseDefinitionVersionTag ?? '-',
          basedOnVersionTag: caseDefinition.basedOnVersionTag ?? '-',
        };

        return Object.entries(releaseVersionData).map(([key, value]) => ({key, value}));
      })
    );

  public readonly releaseInformationDataEntries$: Observable<
    {key: string; value: string | Date}[]
  > = this.caseDefinition$.pipe(
    map(caseDefinition => {
      const releaseInformationData = {
        createdBy: caseDefinition.createdBy ?? '-',
        createdDate: this.datePipe.transform(caseDefinition.createdDate ?? '', 'dd-MM-yyyy'),
        description: caseDefinition.description ?? '-',
      };

      return Object.entries(releaseInformationData).map(([key, value]) => ({key, value}));
    })
  );

  private _currentNotification!: Notification;

  constructor(
    private readonly caseManagementService: CaseManagementService,
    private readonly iconService: IconService,
    private readonly breadcrumbService: BreadcrumbService,
    private readonly translateService: TranslateService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly datePipe: DatePipe,
    private readonly notificationService: GlobalNotificationService
  ) {
    this.iconService.register(Return16);
    this.iconService.register(TrashCan16);
    this.iconService.register(Save16);
  }

  public ngAfterViewInit(): void {
    this.initBreadcrumbs();
  }

  public goToCaseList(): void {
    this.breadcrumbService.clearThirdBreadcrumb();
    this.breadcrumbService.clearSecondBreadcrumb();
    this.router.navigate(['/case-management']);
  }

  public goBack(): void {
    this.breadcrumbService.clearThirdBreadcrumb();
    combineLatest([this.caseDefinitionKey$, this.caseDefinitionVersionTag$])
      .pipe(
        tap(([caseDefinitionKey, caseDefinitionVersionTag]) => {
          this.router.navigate([
            '/case-management/case',
            caseDefinitionKey,
            'version',
            caseDefinitionVersionTag,
          ]);
        })
      )
      .subscribe();
  }

  public openDeleteDraftConfirmationModal(): void {
    this.showDeleteDraftConfirmationModal$.next(true);
  }

  public closeDeleteDraftConfirmationModal(): void {
    this.showDeleteDraftConfirmationModal$.next(false);
  }

  public openFinalizeDraftConfirmationModal(): void {
    this.showFinalizeDraftConfirmationModal$.next(true);
  }

  public closeFinalizeDraftConfirmationModal(): void {
    this.showFinalizeDraftConfirmationModal$.next(false);
  }

  public deleteDraftCaseVersion(): void {
    this._currentNotification = this.notificationService.showNotification({
      type: 'info',
      title: '',
      showClose: false,
      template: this._draftMessageTemplateRef,
    });

    combineLatest([this.caseDefinitionKey$, this.caseDefinitionVersionTag$])
      .pipe(
        take(1),
        switchMap(([caseDefinitionKey, caseDefinitionVersionTag]) =>
          this.caseManagementService.deleteDraftCaseVersion(
            caseDefinitionKey,
            caseDefinitionVersionTag
          )
        )
      )
      .subscribe({
        next: response => {
          this.closeCurrentNotification();
          this._currentNotification = this.notificationService.showNotification({
            type: 'success',
            title: this.translateService.instant(
              'caseManagement.deployment.finalizeDraftConfirmationModal.successMessage'
            ),
            duration: 5000,
          });

          this.goToCaseList();
        },
        error: () => {
          this.closeCurrentNotification();
          this._currentNotification = this.notificationService.showNotification({
            type: 'error',
            title: this.translateService.instant(
              'caseManagement.deployment.deleteDraftConfirmationModal.errorMessage'
            ),
            message: this.translateService.instant(
              'caseManagement.deployment.deleteDraftConfirmationModal.errorMessage'
            ),
            duration: 5000,
          });
        },
      });

    this.closeDeleteDraftConfirmationModal();
  }

  public finalizeDraftCaseVersion(): void {
    this._currentNotification = this.notificationService.showNotification({
      type: 'info',
      title: '',
      showClose: false,
      template: this._draftMessageTemplateRef,
    });

    combineLatest([this.caseDefinitionKey$, this.caseDefinitionVersionTag$])
      .pipe(
        take(1),
        switchMap(([caseDefinitionKey, caseDefinitionVersionTag]) => {
          return this.caseManagementService.finalizeDraftCaseVersion(
            caseDefinitionKey,
            caseDefinitionVersionTag
          );
        })
      )
      .subscribe({
        next: response => {
          this.closeCurrentNotification();
          this._currentNotification = this.notificationService.showNotification({
            type: 'success',
            title: this.translateService.instant(
              'caseManagement.deployment.finalizeDraftConfirmationModal.successMessage'
            ),
            duration: 5000,
          });
        },
        error: () => {
          this.closeCurrentNotification();
          this._currentNotification = this.notificationService.showNotification({
            type: 'error',
            title: this.translateService.instant(
              'caseManagement.deployment.deleteDraftConfirmationModal.errorMessage'
            ),
            message: this.translateService.instant(
              'caseManagement.deployment.deleteDraftConfirmationModal.errorMessage'
            ),
            duration: 5000,
          });
        },
      });

    this.closeFinalizeDraftConfirmationModal();
  }

  private initBreadcrumbs(): void {
    combineLatest([this.params$, this._caseDefinitionTitle$])
      .pipe(
        tap(([{caseDefinitionKey, caseDefinitionVersionTag}, caseDefinitionTitle]) => {
          const route = `/case-management/case/${caseDefinitionKey}/version/${caseDefinitionVersionTag}`;

          this.breadcrumbService.setThirdBreadcrumb({
            route: [route],
            content: `${caseDefinitionTitle} `,
            href: route,
          });
        })
      )
      .subscribe();
  }

  private closeCurrentNotification(): void {
    if (this._currentNotification) {
      this.notificationService.close(this._currentNotification);
    }
  }
}
