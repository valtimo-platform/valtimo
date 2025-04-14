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
import {DOCUMENT} from '@angular/common';
import {HttpResponse} from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Inject,
  Input,
  Output,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {PageHeaderService} from '@valtimo/components';
import {ListItem, Notification} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable, of, switchMap, tap} from 'rxjs';
import {take} from 'rxjs/operators';
import {CaseDetailService, CaseManagementService} from '../../services';
import {CaseManagementRemoveModalComponent} from '../case-management-remove-modal/case-management-remove-modal.component';
import {GlobalNotificationService} from '@valtimo/layout';
import {eq, lt, valid} from 'semver';

@Component({
  selector: 'valtimo-case-management-detail-container-actions',
  templateUrl: './case-management-detail-container-actions.component.html',
  styleUrls: ['./case-management-detail-container-actions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseManagementDetailContainerActionsComponent {
  @ViewChild('exportingMessage')
  private readonly _exportMessageTemplateRef: TemplateRef<HTMLDivElement>;
  @ViewChild('caseRemoveModal')
  private readonly _caseRemoveModal: CaseManagementRemoveModalComponent;

  @Input() public documentDefinitionTitle = '';
  @Input() public set caseDefinitionKey(value: string) {
    this.caseDetailService.setSelectedDocumentDefinitionName(value);
  }
  @Output() public versionSet = new EventEmitter<number>();

  public readonly CARBON_THEME = 'g10';

  public readonly exporting$ = new BehaviorSubject<boolean>(false);
  public readonly selectedVersionNumber$ = this.caseDetailService.selectedVersionNumber$;
  public readonly selectedVersion$ = new BehaviorSubject<string>('');
  public readonly currentGlobalActiveVersion$ = new BehaviorSubject<string>('');

  public readonly params$: Observable<{
    caseDefinitionKey: string;
    caseDefinitionVersionTag: string;
  }> = this.route.params.pipe(
    map(({caseDefinitionKey, caseDefinitionVersionTag}) => ({
      caseDefinitionKey: caseDefinitionKey,
      caseDefinitionVersionTag: caseDefinitionVersionTag,
    })),
    tap(({caseDefinitionKey, caseDefinitionVersionTag}) =>
      this.selectedVersion$.next(caseDefinitionVersionTag)
    )
  );

  public readonly caseDefinitionKey$: Observable<string> = this.params$.pipe(
    map(params => params.caseDefinitionKey || '')
  );

  public readonly caseDefinitionVersionTag$: Observable<string> = this.params$.pipe(
    map(params => params.caseDefinitionVersionTag || '')
  );

  public readonly selectedVersionIsGloballyActive$: Observable<boolean> =
    this.caseDefinitionKey$?.pipe(
      switchMap(caseDefinitionKey =>
        this.caseManagementService.getGlobalActiveCase(caseDefinitionKey)
      ),
      map(result => !!result?.active)
    );

  private readonly _caseDefinitionKey$ = this.caseDetailService.selectedDocumentDefinitionName$;
  public readonly loadingVersion$ = new BehaviorSubject<boolean>(true);
  public readonly showGlobalVersionModal$ = new BehaviorSubject<boolean>(false);
  public readonly showGlobalVersionConfirmationModal$ = new BehaviorSubject<boolean>(false);

  public readonly selectedDocumentDefinition$ = this.caseDetailService.documentDefinition$;

  public readonly selectedDocumentDefinitionIsReadOnly$ =
    this.caseDetailService.selectedDocumentDefinitionIsReadOnly$;

  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  public readonly selectedVersionIsSameAsActiveVersion$: Observable<boolean> = combineLatest([
    this.currentGlobalActiveVersion$,
    this.selectedVersion$,
  ]).pipe(
    map(([current, selected]) => {
      return valid(current) && valid(selected) && eq(selected, current);
    })
  );

  public readonly isOlderVersionSelected$: Observable<boolean> = combineLatest([
    this.currentGlobalActiveVersion$,
    this.selectedVersion$,
  ]).pipe(
    map(([current, selected]) => {
      return valid(current) && valid(selected) && lt(selected, current);
    })
  );

  private readonly _cachedVersions = new BehaviorSubject<ListItem[] | null>(null);
  public readonly versions$: Observable<ListItem[] | null> = combineLatest([
    this.route.params,
    this.selectedVersion$,
  ]).pipe(
    switchMap(([{caseDefinitionKey}, selectedVersion]) =>
      combineLatest([
        this._cachedVersions.getValue() === null
          ? this.caseManagementService.getCaseDefinitionVersions(caseDefinitionKey)
          : this._cachedVersions.asObservable(),
        of(selectedVersion),
      ])
    ),
    map(([caseDefinitionVersions, selectedVersion]) => {
      const mapping: ListItem[] | null =
        caseDefinitionVersions?.map((caseDefinitionVersion: string) => ({
          content: caseDefinitionVersion,
          selected: caseDefinitionVersion === selectedVersion,
          tagType: 'green',
        })) ?? null;

      return mapping;
    })
  );

  private _currentNotification!: Notification;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private readonly caseManagementService: CaseManagementService,
    private readonly caseDetailService: CaseDetailService,
    private readonly notificationService: GlobalNotificationService,
    private readonly pageHeaderService: PageHeaderService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly translateService: TranslateService
  ) {}

  public export(): void {
    this.closeCurrentNotification();

    this._currentNotification = this.notificationService.showNotification({
      type: 'info',
      title: '',
      showClose: false,
      template: this._exportMessageTemplateRef,
    });
    let selectedVersionNumber!: number;

    this.startExporting();

    combineLatest([this.selectedVersionNumber$, this._caseDefinitionKey$])
      .pipe(
        take(1),
        tap(([selectedVersion]) => (selectedVersionNumber = selectedVersion ?? 0)),
        switchMap(([selectedVersion, documentDefinitionName]) =>
          this.caseManagementService.exportDocumentDefinition(
            documentDefinitionName,
            selectedVersion ?? 0
          )
        )
      )
      .subscribe({
        next: response => {
          this.closeCurrentNotification();
          this._currentNotification = this.notificationService.showNotification({
            type: 'success',
            title: this.translateService.instant('caseManagement.exportSuccessTitle'),
            duration: 5000,
          });
          this.downloadZip(response, selectedVersionNumber);
          this.stopExporting();
        },
        error: () => {
          this.closeCurrentNotification();
          this._currentNotification = this.notificationService.showNotification({
            type: 'error',
            title: this.translateService.instant('caseManagement.exportErrorTitle'),
            message: this.translateService.instant('caseManagement.exportErrorMessage'),
            duration: 5000,
          });
          this.stopExporting();
        },
      });
  }

  public setVersion(version: any): void {
    this.selectedVersion$.next(version?.item?.content);
    this.router.navigate(
      [`../${version.item.content}/${this.route.firstChild?.routeConfig?.path}`],
      {relativeTo: this.route}
    );
  }

  public openCaseRemoveModal(): void {
    this.selectedDocumentDefinition$.pipe(take(1)).subscribe(definition => {
      if (!definition) return;

      this._caseRemoveModal.openModal(definition);
    });
  }

  public openGlobalActiveVersionModal(): void {
    this.showGlobalVersionModal$.next(true);
  }

  public closeGlobalVersionCaseModal(): void {
    this.showGlobalVersionModal$.next(false);
  }

  public openGlobalCaseVersionConfirmationModal(): void {
    this.showGlobalVersionModal$.next(false);
    this.showGlobalVersionConfirmationModal$.next(true);
  }

  public closeGlobalCaseConfirmationModal(): void {
    this.showGlobalVersionConfirmationModal$.next(false);
  }

  public setGlobalActiveCaseVersion(): void {
    this._currentNotification = this.notificationService.showNotification({
      type: 'info',
      title: '',
      showClose: false,
      template: this._exportMessageTemplateRef,
    });

    combineLatest([this._caseDefinitionKey$, this.selectedVersion$])
      .pipe(
        take(1),
        switchMap(([caseDefinitionKey, selectedVersion]) =>
          this.caseManagementService.setGlobalActiveCaseVersion(caseDefinitionKey, selectedVersion)
        )
      )
      .subscribe({
        next: response => {
          this.closeCurrentNotification();
          this._currentNotification = this.notificationService.showNotification({
            type: 'success',
            title: this.translateService.instant(
              'caseManagement.setGlobalActiveVersionSuccessTitle'
            ),
            duration: 5000,
          });
        },
        error: () => {
          this.closeCurrentNotification();
          this._currentNotification = this.notificationService.showNotification({
            type: 'error',
            title: this.translateService.instant('caseManagement.setGlobalActiveVersionErrorTitle'),
            message: this.translateService.instant(
              'caseManagement.setGlobalActiveVersionErrorMessage'
            ),
            duration: 5000,
          });
        },
      });

    this.showGlobalVersionConfirmationModal$.next(false);
  }

  private startExporting(): void {
    this.exporting$.next(true);
  }

  private stopExporting(): void {
    this.exporting$.next(false);
  }

  private downloadZip(response: HttpResponse<Blob>, versionNumber: number): void {
    const link = document.createElement('a');
    const contentDisposition = response.headers.get('content-disposition');
    const splitContentDisposition = contentDisposition?.split('filename=') ?? [];
    const fileName = splitContentDisposition.length > 1 && splitContentDisposition[1];

    link.href = this.document.defaultView?.URL.createObjectURL(response.body) ?? '';
    link.download = fileName || `${this.caseDefinitionKey}_${versionNumber}.valtimo.zip`;
    link.target = '_blank';
    link.click();
    link.remove();
  }

  private closeCurrentNotification(): void {
    if (this._currentNotification) {
      this.notificationService.close(this._currentNotification);
    }
  }

  private findLargestInArray(array: Array<number>): number {
    return array.reduce(function (a, b) {
      return a > b ? a : b;
    });
  }
}
