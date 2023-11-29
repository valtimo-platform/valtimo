/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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

import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  Input,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {BehaviorSubject, switchMap, tap} from 'rxjs';
import {Notification, NotificationService} from 'carbon-components-angular';
import {DossierExportService} from '../../services';
import {TranslateService} from '@ngx-translate/core';
import {DOCUMENT} from '@angular/common';
import {HttpResponse} from '@angular/common/http';

@Component({
  selector: 'valtimo-dossier-management-detail-container-actions',
  templateUrl: './dossier-management-detail-container-actions.html',
  styleUrls: ['./dossier-management-detail-container-actions.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [NotificationService],
})
export class DossierManagementDetailContainerActionsComponent {
  @ViewChild('exportingMessage')
  private readonly _exportMessageTemplateRef: TemplateRef<HTMLDivElement>;

  @Input() public documentDefinitionTitle = '';
  @Input() public documentDefinitionName = '';

  public readonly exporting$ = new BehaviorSubject<boolean>(false);
  public readonly selectedVersionNumber$ = new BehaviorSubject<number>(1);

  private _currentNotification!: Notification;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private readonly notificationService: NotificationService,
    private readonly dossierExportService: DossierExportService,
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

    this.selectedVersionNumber$
      .pipe(
        tap(selectedVersion => (selectedVersionNumber = selectedVersion)),
        switchMap(selectedVersion =>
          this.dossierExportService.exportDocumentDefinition(
            this.documentDefinitionName,
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
}
