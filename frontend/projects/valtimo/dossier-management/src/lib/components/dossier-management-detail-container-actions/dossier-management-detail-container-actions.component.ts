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
import {DocumentService} from '@valtimo/document';
import {ListItem, Notification, NotificationService} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable, of, switchMap, tap} from 'rxjs';
import {take} from 'rxjs/operators';
import {CaseManagementService, DossierDetailService, DossierExportService} from '../../services';
import {DossierManagementRemoveModalComponent} from '../dossier-management-remove-modal/dossier-management-remove-modal.component';

@Component({
  selector: 'valtimo-dossier-management-detail-container-actions',
  templateUrl: './dossier-management-detail-container-actions.component.html',
  styleUrls: ['./dossier-management-detail-container-actions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [NotificationService],
})
export class DossierManagementDetailContainerActionsComponent {
  @ViewChild('exportingMessage')
  private readonly _exportMessageTemplateRef: TemplateRef<HTMLDivElement>;
  @ViewChild('dossierRemoveModal')
  private readonly _dossierRemoveModal: DossierManagementRemoveModalComponent;

  @Input() public documentDefinitionTitle = '';
  @Input() public set caseDefinitionName(value: string) {
    this.dossierDetailService.setSelectedDocumentDefinitionName(value);
  }
  @Output() public versionSet = new EventEmitter<number>();

  public readonly CARBON_THEME = 'g10';

  public readonly exporting$ = new BehaviorSubject<boolean>(false);
  public readonly selectedVersionNumber$ = this.dossierDetailService.selectedVersionNumber$;

  private readonly _caseDefinitionName$ = this.dossierDetailService.selectedDocumentDefinitionName$;
  public readonly loadingVersion$ = new BehaviorSubject<boolean>(true);

  public readonly selectedDocumentDefinition$ = this.dossierDetailService.documentDefinition$;

  public readonly selectedDocumentDefinitionIsReadOnly$ =
    this.dossierDetailService.selectedDocumentDefinitionIsReadOnly$;

  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  private readonly _cachedVersions = new BehaviorSubject<ListItem[] | null>(null);
  public readonly versions$: Observable<ListItem[] | null> = this.route.params.pipe(
    switchMap(({caseDefinitionName, caseVersionTag}) =>
      combineLatest([
        this._cachedVersions.getValue() === null
          ? this.caseManagementService.getCaseDefinitionVersions(caseDefinitionName)
          : this._cachedVersions.asObservable(),
        of(caseVersionTag),
      ])
    ),
    map(([caseDefinitionVersions, caseVersionTag]) => {
      const mapping: ListItem[] | null =
        caseDefinitionVersions?.map((caseDefinitionVersion: string) => ({
          content: caseDefinitionVersion,
          selected: caseDefinitionVersion === caseVersionTag,
        })) ?? null;

      if (this._cachedVersions.getValue() === null) this._cachedVersions.next(mapping);

      return mapping;
    })
  );

  private _currentNotification!: Notification;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private readonly notificationService: NotificationService,
    private readonly dossierExportService: DossierExportService,
    private readonly translateService: TranslateService,
    private readonly documentService: DocumentService,
    private readonly dossierDetailService: DossierDetailService,
    private readonly pageHeaderService: PageHeaderService,
    private readonly caseManagementService: CaseManagementService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
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

    combineLatest([this.selectedVersionNumber$, this._caseDefinitionName$])
      .pipe(
        take(1),
        tap(([selectedVersion]) => (selectedVersionNumber = selectedVersion)),
        switchMap(([selectedVersion, documentDefinitionName]) =>
          this.dossierExportService.exportDocumentDefinition(
            documentDefinitionName,
            selectedVersion
          )
        )
      )
      .subscribe({
        next: response => {
          this.closeCurrentNotification();
          this._currentNotification = this.notificationService.showNotification({
            type: 'success',
            title: this.translateService.instant('dossierManagement.exportSuccessTitle'),
            duration: 5000,
          });
          this.downloadZip(response, selectedVersionNumber);
          this.stopExporting();
        },
        error: () => {
          this.closeCurrentNotification();
          this._currentNotification = this.notificationService.showNotification({
            type: 'error',
            title: this.translateService.instant('dossierManagement.exportErrorTitle'),
            message: this.translateService.instant('dossierManagement.exportErrorMessage'),
            duration: 5000,
          });
          this.stopExporting();
        },
      });
  }

  public setVersion(version: any): void {
    this.router.navigate(
      [`../${version.item.content}/${this.route.firstChild?.routeConfig?.path}`],
      {relativeTo: this.route}
    );
  }

  public openDossierRemoveModal(): void {
    this.selectedDocumentDefinition$.pipe(take(1)).subscribe(definition => {
      this._dossierRemoveModal.openModal(definition);
    });
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
    const splitContentDisposition = contentDisposition.split('filename=');
    const fileName = splitContentDisposition.length > 1 && splitContentDisposition[1];

    link.href = this.document.defaultView.URL.createObjectURL(response.body);
    link.download = fileName || `${this.caseDefinitionName}_${versionNumber}.valtimo.zip`;
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
