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

import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {DocumentService, FileSortService, RelatedFile} from '@valtimo/document';
import {DownloadService, ResourceDto, UploadProviderService} from '@valtimo/resource';
import {ToastrService} from 'ngx-toastr';
import {map, switchMap} from 'rxjs/operators';
import {BehaviorSubject, combineLatest, Observable} from 'rxjs';
import {TranslateService} from '@ngx-translate/core';
import {ConfigService} from '@valtimo/config';
import {PromptService} from '@valtimo/components';

@Component({
  selector: 'valtimo-dossier-detail-tab-s3-documents',
  templateUrl: './s3-documents.component.html',
  styleUrls: ['./s3-documents.component.scss'],
})
export class DossierDetailTabS3DocumentsComponent implements OnInit {
  public readonly documentId: string;
  public readonly documentDefinitionName: string;
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
    private readonly route: ActivatedRoute,
    private readonly documentService: DocumentService,
    private readonly toastrService: ToastrService,
    private readonly uploadProviderService: UploadProviderService,
    private readonly downloadService: DownloadService,
    private readonly promptService: PromptService,
    private readonly translateService: TranslateService,
    private readonly configService: ConfigService,
    private readonly fileSortService: FileSortService
  ) {
    const snapshot = this.route.snapshot.paramMap;
    this.documentId = snapshot.get('documentId') || '';
    this.documentDefinitionName = snapshot.get('documentDefinitionName') || '';
  }

  ngOnInit(): void {
    this.refetchDocuments();
  }

  fileSelected(file: File): void {
    this.uploading$.next(true);

    this.uploadProviderService
      .uploadFile(file, this.documentDefinitionName, this.documentId)
      .pipe(
        switchMap(resourceFile =>
          this.documentService.assignResource(this.documentId, resourceFile.data.resourceId)
        )
      )
      .subscribe({
        next: () => {
          this.toastrService.success('Successfully uploaded document to dossier');
          this.refetchDocuments();
          this.uploading$.next(false);
        },
        error: () => {
          this.toastrService.error('Failed to upload document to dossier');
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
      headerText: this.translateService.instant('dossier.deleteConfirmation.title'),
      bodyText: this.translateService.instant('dossier.deleteConfirmation.description'),
      cancelButtonText: this.translateService.instant('dossier.deleteConfirmation.cancel'),
      confirmButtonText: this.translateService.instant('dossier.deleteConfirmation.delete'),
      cancelMdiIcon: 'cancel',
      confirmMdiIcon: 'delete',
      cancelButtonType: 'secondary',
      confirmButtonType: 'primary',
      closeOnConfirm: true,
      closeOnCancel: true,
      confirmCallBackFunction: () => {
        this.documentService.removeResource(this.documentId, relatedFile.fileId).subscribe(
          () => {
            this.toastrService.success('Successfully removed document from dossier');
            this.refetchDocuments();
          },
          () => {
            this.toastrService.error('Failed to remove document from dossier');
          }
        );
      },
    });
  }

  private refetchDocuments(): void {
    this.refetch$.next(null);
  }
}
