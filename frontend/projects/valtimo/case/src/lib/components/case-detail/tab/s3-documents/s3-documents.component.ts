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

import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {DocumentService, FileSortService, RelatedFile} from '@valtimo/document';
import {DownloadService, ResourceDto, UploadProviderService} from '@valtimo/resource';
import {map, switchMap} from 'rxjs/operators';
import {BehaviorSubject, combineLatest, Observable} from 'rxjs';
import {TranslateService} from '@ngx-translate/core';
import {ConfigService, GlobalNotificationService} from '@valtimo/config';
import {PromptService} from '@valtimo/components';

@Component({
  standalone: false,
  selector: 'valtimo-case-detail-tab-s3-documents',
  templateUrl: './s3-documents.component.html',
})
export class CaseDetailTabS3DocumentsComponent implements OnInit {
  public readonly documentId: string;
  public readonly caseDefinitionKey: string;
  public readonly maxFileSize: number = this.configService?.config?.caseFileSizeUploadLimitMB || 5;
  public readonly acceptedFiles: string =
    this.configService?.config?.caseFileUploadAcceptedFiles || null;
  public fields = [
    {key: 'fileName', label: 'File name'},
    {key: 'sizeInBytes', label: 'Size in bytes'},
    {key: 'createdOn', label: 'Created on', viewType: 'date'},
    {key: 'createdBy', label: 'Created by'},
  ];
  public actions = [
    {
      columnName: '',
      iconClass: 'mdi mdi-open-in-new',
      callback: this.downloadDocument.bind(this),
    },
    {
      columnName: '',
      iconClass: 'mdi mdi-delete',
      callback: this.removeRelatedFile.bind(this),
    },
  ];
  readonly uploading$ = new BehaviorSubject<boolean>(false);
  private readonly refetch$ = new BehaviorSubject<null>(null);
  public relatedFiles$: Observable<Array<RelatedFile>> = this.refetch$.pipe(
    switchMap(() =>
      combineLatest([
        this.documentService.getDocument(this.documentId),
        this.translateService.stream('key'),
      ])
    ),
    map(([document]) => {
      const relatedFiles = document?.relatedFiles || [];
      const translatedFiles = relatedFiles.map(file => ({
        ...file,
        createdBy: file.createdBy || this.translateService.instant('list.automaticallyGenerated'),
      }));

      return translatedFiles || [];
    }),
    map(relatedFiles => this.fileSortService.sortRelatedFilesByDateDescending(relatedFiles))
  );

  constructor(
    private readonly configService: ConfigService,
    private readonly documentService: DocumentService,
    private readonly downloadService: DownloadService,
    private readonly fileSortService: FileSortService,
    private readonly globalNotificationService: GlobalNotificationService,
    private readonly promptService: PromptService,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService,
    private readonly uploadProviderService: UploadProviderService
  ) {
    const snapshot = this.route.snapshot.paramMap;
    this.documentId = snapshot.get('documentId') || '';
    this.caseDefinitionKey = snapshot.get('caseDefinitionKey') || '';
  }

  ngOnInit(): void {
    this.refetchDocuments();
  }

  fileSelected(file: File): void {
    this.uploading$.next(true);

    this.uploadProviderService
      .uploadFile(file, this.caseDefinitionKey, this.documentId)
      .pipe(
        switchMap(resourceFile =>
          this.documentService.assignResource(this.documentId, resourceFile.data.resourceId)
        )
      )
      .subscribe({
        next: () => {
          this.globalNotificationService.showToast({
            title: this.translateService.instant('case.documenten.uploadSuccessful'),
            type: 'success',
          });
          this.refetchDocuments();
          this.uploading$.next(false);
        },
        error: () => {
          this.globalNotificationService.showToast({
            title: this.translateService.instant('case.documenten.uploadFailed'),
            type: 'error',
          });
          this.uploading$.next(false);
        },
      });
  }

  downloadDocument(relatedFile: RelatedFile): void {
    this.uploadProviderService
      .getResource(relatedFile.fileId)
      .subscribe((resource: ResourceDto) => {
        this.downloadService.downloadFile(resource.url, resource.resource.name);
      });
  }

  removeRelatedFile(relatedFile: RelatedFile) {
    this.promptService.openPrompt({
      headerText: this.translateService.instant('case.deleteConfirmation.title'),
      bodyText: this.translateService.instant('case.deleteConfirmation.description'),
      cancelButtonText: this.translateService.instant('case.deleteConfirmation.cancel'),
      confirmButtonText: this.translateService.instant('case.deleteConfirmation.delete'),
      cancelMdiIcon: 'cancel',
      confirmMdiIcon: 'delete',
      cancelButtonType: 'secondary',
      confirmButtonType: 'primary',
      closeOnConfirm: true,
      closeOnCancel: true,
      confirmCallBackFunction: () => {
        this.documentService.removeResource(this.documentId, relatedFile.fileId).subscribe(
          () => {
            this.globalNotificationService.showToast({
              title: this.translateService.instant('case.documenten.removeSuccessful'),
              type: 'success',
            });
            this.refetchDocuments();
          },
          () => {
            this.globalNotificationService.showToast({
              title: this.translateService.instant('case.documenten.removeFailed'),
              type: 'success',
            });
          }
        );
      },
    });
  }

  private refetchDocuments(): void {
    this.refetch$.next(null);
  }
}
