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

import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {DocumentService} from '@valtimo/document';
import {Document, RelatedFile, ResourceDto} from '@valtimo/contract';
import {ToastrService} from 'ngx-toastr';
import {DownloadService, UploadProviderService} from '@valtimo/resource';
import {switchMap} from 'rxjs/operators';
import {BehaviorSubject} from 'rxjs';

@Component({
  selector: 'valtimo-dossier-detail-tab-documents',
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.css'],
})
export class DossierDetailTabDocumentsComponent implements OnInit {
  public readonly documentId: string;
  public readonly documentDefinitionName: string;
  public relatedFiles: RelatedFile[] = [];
  public fields = [
    {key: 'fileName', label: 'File name'},
    {key: 'sizeInBytes', label: 'Size in bytes'},
    {key: 'createdOn', label: 'Created on', viewType: 'date'},
    {key: 'createdBy', label: 'Created by'},
  ];
  public actions = [
    {
      columnName: '',
      iconClass: 'fas fa-external-link-alt',
      callback: this.downloadDocument.bind(this),
    },
    {
      columnName: '',
      iconClass: 'fas fa-trash-alt',
      callback: this.removeRelatedFile.bind(this),
    },
  ];

  readonly uploading$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly documentService: DocumentService,
    private readonly toastrService: ToastrService,
    private readonly uploadProviderService: UploadProviderService,
    private readonly downloadService: DownloadService
  ) {
    const snapshot = this.route.snapshot.paramMap;
    this.documentId = snapshot.get('documentId') || '';
    this.documentDefinitionName = snapshot.get('documentDefinitionName') || '';
  }

  ngOnInit(): void {
    this.loadDocuments();
  }

  fileSelected(file: File): void {
    this.uploading$.next(true);

    this.uploadProviderService
      .uploadFile(file, this.documentDefinitionName)
      .pipe(
        switchMap(resourceFile =>
          this.documentService.assignResource(this.documentId, resourceFile.data.resourceId)
        )
      )
      .subscribe(
        () => {
          this.toastrService.success('Successfully uploaded document to dossier');
          this.loadDocuments();
          this.uploading$.next(false);
        },
        () => {
          this.toastrService.error('Failed to upload document to dossier');
          this.uploading$.next(false);
        }
      );
  }

  loadDocuments(): void {
    this.documentService.getDocument(this.documentId).subscribe((document: Document) => {
      this.relatedFiles = document.relatedFiles;
    });
  }

  downloadDocument(relatedFile: RelatedFile): void {
    this.uploadProviderService
      .getResource(relatedFile.fileId)
      .subscribe((resource: ResourceDto) => {
        this.downloadService.downloadFile(resource.url, resource.resource.name);
      });
  }

  removeRelatedFile(relatedFile: RelatedFile): void {
    this.documentService.removeResource(this.documentId, relatedFile.fileId).subscribe(
      () => {
        this.toastrService.success('Successfully removed document from dossier');
        this.loadDocuments();
      },
      () => {
        this.toastrService.error('Failed to remove document from dossier');
      }
    );
  }
}
