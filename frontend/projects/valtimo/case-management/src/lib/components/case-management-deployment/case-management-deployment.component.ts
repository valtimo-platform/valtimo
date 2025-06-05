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
import {DatePipe, Location as AngularLocation} from '@angular/common';
import {AfterViewInit, Component, OnInit, TemplateRef, ViewChild} from '@angular/core';
import {FormBuilder} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {Return16, Save16, TrashCan16} from '@carbon/icons';
import {TranslateService} from '@ngx-translate/core';
import {BreadcrumbService} from '@valtimo/components';
import {EnvironmentService, GlobalNotificationService} from '@valtimo/shared';
import {IconService, Notification} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable, switchMap} from 'rxjs';
import {take, tap} from 'rxjs/operators';
import * as semver from 'semver';
import {CaseDefinition} from '../../models/case-deployment.model';
import {CaseManagementService} from '../../services';

@Component({
  standalone: false,
  templateUrl: './case-management-deployment.component.html',
  styleUrls: ['./case-management-deployment.component.scss'],
})
export class CaseManagementDeploymentComponent implements OnInit, AfterViewInit {
  @ViewChild('createDraftMessage')
  private readonly _createDraftMessageTemplateRef: TemplateRef<HTMLDivElement>;

  @ViewChild('finalizeDraftMessage')
  private readonly _finalizeDraftMessageTemplateRef: TemplateRef<HTMLDivElement>;

  @ViewChild('deleteDraftMessage')
  private readonly _deleteDraftMessageTemplateRef: TemplateRef<HTMLDivElement>;

  public caseDefinitionVersions: string[] = [];
  public readonly isDraftVersion$ = new BehaviorSubject<boolean>(false);
  public readonly hasConflictingVersions$ = new BehaviorSubject<boolean>(false);
  public readonly showDeleteDraftConfirmationModal$ = new BehaviorSubject<boolean>(false);
  public readonly showFinalizeDraftConfirmationModal$ = new BehaviorSubject<boolean>(false);
  public readonly showCreateDraftVersionConfirmationModal$ = new BehaviorSubject<boolean>(false);

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

  public readonly canUpdateGlobalConfiguration$ =
    this.environmentService.canUpdateGlobalConfiguration();

  private getDraftDescription$(translationKey: string): Observable<string> {
    return combineLatest([
      this.caseDefinitionKey$,
      this.caseDefinitionVersionTag$,
      this.translateService.stream('key'),
    ]).pipe(
      switchMap(([caseDefinitionKey, caseDefinitionVersionTag]) =>
        this.translateService.get(translationKey, {caseDefinitionKey, caseDefinitionVersionTag})
      )
    );
  }

  public readonly finalizeDraftDescription$ = this.getDraftDescription$(
    'caseManagement.deployment.finalizeDraftConfirmationModal.description'
  );

  public readonly globalActiveCase$: Observable<any> = this.caseDefinitionKey$.pipe(
    switchMap(caseDefinitionKey =>
      this.caseManagementService.getGlobalActiveCase(caseDefinitionKey)
    )
  );

  public readonly isGloballyActive$: Observable<boolean> = combineLatest([
    this.globalActiveCase$,
    this.caseDefinitionKey$,
    this.caseDefinitionVersionTag$,
  ]).pipe(
    map(([globalActiveCase, caseDefinitionKey, caseDefinitionVersionTag]) => {
      return (
        globalActiveCase.caseDefinitionKey === caseDefinitionKey &&
        globalActiveCase.caseDefinitionVersionTag === caseDefinitionVersionTag
      );
    })
  );

  public readonly _caseDefinitionTitle$: Observable<string> = this.globalActiveCase$.pipe(
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

  public readonly caseDefinitionPayload$ = combineLatest([
    this.caseDefinitionKey$,
    this.caseDefinitionVersionTag$,
  ]).pipe(
    switchMap(([caseDefinitionKey, caseDefinitionVersionTag]) =>
      this.caseManagementService.getCaseDefinition(caseDefinitionKey, caseDefinitionVersionTag)
    ),
    map(caseDefinition => ({
      name: caseDefinition.name,
      caseDefinitionKey: caseDefinition.caseDefinitionKey,
      caseDefinitionVersion: semver.inc(caseDefinition.caseDefinitionVersionTag, 'patch'),
      description: caseDefinition.description,
      basedOnCaseDefinitionVersion: caseDefinition.caseDefinitionVersionTag,
    }))
  );

  public readonly caseDefinitionVersions$: Observable<any[] | null> = this.caseDefinitionKey$.pipe(
    switchMap(caseDefinitionKey =>
      this.caseManagementService.getCaseDefinitionVersions(caseDefinitionKey)
    ),
    map(caseDefinitions => caseDefinitions.map(caseDefinition => caseDefinition.versionTag))
  );

  public readonly notificationContent$: Observable<{
    basedOnVersionTag: string;
    conflictingVersions: string;
  }> = this.caseDefinition$.pipe(
    map(({basedOnVersionTag, conflictingVersions}) => ({
      basedOnVersionTag: basedOnVersionTag ?? '-',
      conflictingVersions: conflictingVersions ?? '-',
    }))
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
    private readonly breadcrumbService: BreadcrumbService,
    private readonly caseManagementService: CaseManagementService,
    private readonly datePipe: DatePipe,
    private readonly environmentService: EnvironmentService,
    private readonly iconService: IconService,
    private readonly location: AngularLocation,
    private readonly notificationService: GlobalNotificationService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly translateService: TranslateService
  ) {
    this.iconService.register(Return16);
    this.iconService.register(TrashCan16);
    this.iconService.register(Save16);
  }

  public ngOnInit(): void {
    this.caseDefinitionVersions$.pipe(take(1)).subscribe(versions => {
      this.caseDefinitionVersions = versions || [];
    });
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
    this.location.back();
  }

  public openDeleteDraftModal(): void {
    this.showDeleteDraftConfirmationModal$.next(true);
  }

  public closeDeleteDraftModal(): void {
    this.showDeleteDraftConfirmationModal$.next(false);
  }

  public openFinalizeDraftConfirmationModal(): void {
    this.showFinalizeDraftConfirmationModal$.next(true);
  }

  public closeFinalizeDraftModal(): void {
    this.showFinalizeDraftConfirmationModal$.next(false);
  }

  public openCreateDraftVersionConfirmationModal(): void {
    this.showCreateDraftVersionConfirmationModal$.next(true);
  }

  public onCloseCreateDraftVersionModal(payload?): void {
    if (payload) {
      this.createDraftVersion(payload);
    }
    this.showCreateDraftVersionConfirmationModal$.next(false);
  }

  public deleteDraftCaseVersion(): void {
    this._currentNotification = this.notificationService.showNotification({
      type: 'info',
      title: '',
      showClose: false,
      template: this._deleteDraftMessageTemplateRef,
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
              'caseManagement.deployment.deleteDraftConfirmationModal.successTitle'
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

    this.closeDeleteDraftModal();
  }

  public finalizeDraftCaseVersion(): void {
    this._currentNotification = this.notificationService.showNotification({
      type: 'info',
      title: '',
      showClose: false,
      template: this._finalizeDraftMessageTemplateRef,
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
          this.isDraftVersion$.next(false);
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
              'caseManagement.deployment.finalizeDraftConfirmationModal.errorMessage'
            ),
            message: this.translateService.instant(
              'caseManagement.deployment.finalizeDraftConfirmationModal.errorMessage'
            ),
            duration: 5000,
          });
        },
      });

    this.closeFinalizeDraftModal();
  }

  public createDraftVersion(payload): void {
    this.showInfoNotification(this._createDraftMessageTemplateRef);

    this.caseManagementService.createDraftVersion(payload).subscribe({
      next: (response: any) => {
        this.router.navigate([
          '/case-management/case/',
          response.caseDefinitionKey,
          'version',
          response.caseDefinitionVersionTag,
        ]);
        this.showSuccessNotification(
          'caseManagement.deployment.createDraftConfirmationModal.successMessage'
        );
      },
      error: () => {
        this.showErrorNotification(
          'caseManagement.deployment.createDraftConfirmationModal.errorTitle',
          'caseManagement.deployment.createDraftConfirmationModal.errorMessage'
        );
      },
    });

    this.showCreateDraftVersionConfirmationModal$.next(false);
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

  private showInfoNotification(templateRef: TemplateRef<any>): void {
    this.closeCurrentNotification();
    this._currentNotification = this.notificationService.showNotification({
      type: 'info',
      title: '',
      showClose: false,
      template: templateRef,
    });
  }

  private showSuccessNotification(message: string): void {
    this.closeCurrentNotification();
    this._currentNotification = this.notificationService.showNotification({
      type: 'success',
      title: this.translateService.instant(message),
      duration: 5000,
    });
  }

  private showErrorNotification(titleKey: string, messageKey: string): void {
    this.closeCurrentNotification();
    this._currentNotification = this.notificationService.showNotification({
      type: 'error',
      title: this.translateService.instant(titleKey),
      message: this.translateService.instant(messageKey),
      duration: 5000,
    });
  }
}
