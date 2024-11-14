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
import {RuleDraft16, Save16, Version16, Information16} from '@carbon/icons';
import {TranslateService} from '@ngx-translate/core';
import {CARBON_CONSTANTS, PageHeaderService} from '@valtimo/components';
import {DocumentService} from '@valtimo/document';
import {
  IconService,
  InlineLoadingState,
  ListItem,
  Notification,
  NotificationService,
} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable, switchMap, tap} from 'rxjs';
import {take} from 'rxjs/operators';
import {FINAL_VERSIONS} from '../../mocks';
import {DocumentDefinitionVersion} from '../../models';
import {DossierDetailService, DossierExportService, DossierVersionApiService} from '../../services';
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
  @Input() public set documentDefinitionName(value: string) {
    this.dossierDetailService.setSelectedDocumentDefinitionName(value);
  }
  @Output() public readonly versionSet = new EventEmitter<number>();
  @Output() public readonly collaboratorSelected = new EventEmitter();

  public readonly CARBON_THEME = 'g10';

  public readonly exporting$ = new BehaviorSubject<boolean>(false);
  public readonly selectedVersionNumber$ = this.dossierDetailService.selectedVersionNumber$;
  private readonly _previousSelectedVersionNumber$ =
    this.dossierDetailService.previousSelectedVersionNumber$;
  private readonly _documentDefinitionName$ =
    this.dossierDetailService.selectedDocumentDefinitionName$;
  public readonly loadingVersion$ = new BehaviorSubject<boolean>(true);
  private readonly _documentDefinitionVersions$ = this._documentDefinitionName$.pipe(
    switchMap(documentDefinitionName =>
      this.documentService.getDocumentDefinitionVersions(documentDefinitionName)
    ),
    tap(res => {
      this.dossierDetailService.setSelectedVersionNumber(this.findLargestInArray(res.versions));
      this.loadingVersion$.next(false);
    })
  );
  public readonly draftModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly versionModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly activeVersion$ = this.dossierVersionApiService.activeVersion$;
  public readonly showFinalizeConfirmation$ = new BehaviorSubject<boolean>(false);
  public readonly inlineLoadingState$: Observable<InlineLoadingState> =
    this.dossierVersionApiService.loading$.pipe(
      map((loading: boolean) => (loading ? InlineLoadingState.Active : InlineLoadingState.Finished))
    );

  public readonly versionListItems$: Observable<Array<ListItem>> = combineLatest([
    this._documentDefinitionVersions$,
    this.selectedVersionNumber$,
    this._previousSelectedVersionNumber$,
    this.translateService.stream('key'),
  ]).pipe(
    map(
      ([versionsRes, selectVersionNumber, previousVersionNumber]) =>
        versionsRes?.versions?.map(version => ({
          content: `${this.translateService.instant('dossierManagement.version')}${version}`,
          selected: selectVersionNumber === version || previousVersionNumber === version,
          id: `${version}`,
        })) || []
    )
  );
  public readonly selectedDocumentDefinition$ = this.dossierDetailService.documentDefinition$;

  public readonly selectedDocumentDefinitionIsReadOnly$ =
    this.dossierDetailService.selectedDocumentDefinitionIsReadOnly$;

  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  private _currentNotification!: Notification;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private readonly notificationService: NotificationService,
    private readonly dossierExportService: DossierExportService,
    private readonly translateService: TranslateService,
    private readonly documentService: DocumentService,
    private readonly dossierDetailService: DossierDetailService,
    private readonly pageHeaderService: PageHeaderService,
    private readonly iconService: IconService,
    private readonly dossierVersionApiService: DossierVersionApiService
  ) {
    this.iconService.registerAll([RuleDraft16, Save16, Version16, Information16]);
  }

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

    combineLatest([this.selectedVersionNumber$, this._documentDefinitionName$])
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
    this.versionSet.emit(Number(version.item.id));
  }

  public openDossierRemoveModal(): void {
    this.selectedDocumentDefinition$.pipe(take(1)).subscribe(definition => {
      this._dossierRemoveModal.openModal(definition);
    });
  }

  public onVersionsClick(): void {
    this.versionModalOpen$.next(true);
  }

  public onVersionModalClose(version: DocumentDefinitionVersion | null): void {
    this.versionModalOpen$.next(false);

    if (!version) return;

    this.dossierVersionApiService.setActiveVersion(version);
  }

  public onCreateDraftClick(): void {
    this.draftModalOpen$.next(true);
  }

  public onDraftModalClose(version: DocumentDefinitionVersion | null): void {
    this.draftModalOpen$.next(false);
    if (!version) return;

    this._currentNotification = this.notificationService.showNotification({
      type: 'success',
      title: 'Draft',
      message: 'Version was saved successfully',
      duration: CARBON_CONSTANTS.notificationDuration,
    });
    this.dossierVersionApiService.setActiveVersion(version);
  }

  public onFinalizeDraftClick(): void {
    this.showFinalizeConfirmation$.next(true);
  }

  public onConfirmFinalizeEvent(version: DocumentDefinitionVersion): void {
    this.dossierVersionApiService.finalizeVersion(version);
    this.dossierVersionApiService.setActiveVersion({...version, type: 'final'});
    this._currentNotification = this.notificationService.showNotification({
      type: 'success',
      title: 'Final',
      message: 'Draft has been finalized successfully',
      duration: CARBON_CONSTANTS.notificationDuration,
    });
  }

  public onCollaboratorSelected(): void {
    this.collaboratorSelected.emit();
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
    link.download = fileName || `${this.documentDefinitionName}_${versionNumber}.valtimo.zip`;
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
