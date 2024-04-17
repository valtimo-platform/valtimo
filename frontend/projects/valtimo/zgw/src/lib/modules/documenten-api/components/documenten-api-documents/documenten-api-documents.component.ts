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
import {AfterViewInit, Component, ElementRef, OnInit, TemplateRef, ViewChild} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Filter16, TagGroup16, Upload16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  ActionItem,
  CarbonListModule,
  ColumnConfig,
  DocumentenApiMetadata,
  ViewType,
} from '@valtimo/components';
import {ConfigService} from '@valtimo/config';
import {FileSortService} from '@valtimo/document';
import {DownloadService, UploadProviderService} from '@valtimo/resource';
import {UserProviderService} from '@valtimo/security';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import moment from 'moment';
import {BehaviorSubject, combineLatest, Observable, of, Subject} from 'rxjs';
import {catchError, filter, map, switchMap, take, tap} from 'rxjs/operators';
import {DocumentenApiRelatedFile, DocumentenApiRelatedFileListItem} from '../../models';
import {DocumentenApiDocumentService} from '../../services/documenten-api-document.service';
import {DocumentenApiMetadataModalComponent} from '../documenten-api-metadata-modal/documenten-api-metadata-modal.component';
import {CommonModule} from '@angular/common';

@Component({
  selector: 'valtimo-dossier-detail-tab-documenten-api-documents',
  templateUrl: './documenten-api-documents.component.html',
  styleUrls: ['./documenten-api-documents.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    CarbonListModule,
    DocumentenApiMetadataModalComponent,
    ButtonModule,
    IconModule,
    TranslateModule,
  ],
})
export class DossierDetailTabDocumentenApiDocumentsComponent implements OnInit, AfterViewInit {
  @ViewChild('fileInput') fileInput: ElementRef;
  @ViewChild('sizeTemplate') public sizeTemplate: TemplateRef<any>;

  public fields: ColumnConfig[];
  public actionItems: ActionItem[] = [
    {
      label: 'document.download',
      callback: this.onDownloadActionClick.bind(this),
      type: 'normal',
    },
    {
      label: 'document.delete',
      callback: this.onDeleteActionClick.bind(this),
      type: 'danger',
    },
  ];
  public fieldsConfig = [
    // TODO: Refactor this once admin page config is implemented
    'title',
    'fileName',
    'format',
    'size',
    'description',
    'createdOn',
    'createdBy',
    'author',
    'informatieobjecttype',
    'actions',
  ];

  private readonly _documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params?.documentDefinitionName),
    filter(documentDefinitionName => !!documentDefinitionName)
  );

  private readonly _documentId$: Observable<string> = this.route.params.pipe(
    map(params => params?.documentId),
    filter(documentId => !!documentId)
  );

  public isAdmin: boolean;
  public showZaakLinkWarning: boolean;
  public uploadProcessLinkedSet = false;
  public uploadProcessLinked!: boolean;

  public readonly acceptedFiles: string | null =
    this.configService?.config?.caseFileUploadAcceptedFiles || null;
  public readonly maxFileSize: number = this.configService?.config?.caseFileSizeUploadLimitMB || 5;

  public readonly fileToBeUploaded$ = new BehaviorSubject<File | null>(null);
  public readonly hideModal$ = new Subject<null>();
  public readonly modalDisabled$ = new BehaviorSubject<boolean>(false);
  public readonly showModal$ = new Subject<null>();

  public readonly uploading$ = new BehaviorSubject<boolean>(false);
  public readonly loading$ = new BehaviorSubject<boolean>(true);

  private readonly _refetch$ = new BehaviorSubject<null>(null);

  public relatedFiles$: Observable<Array<DocumentenApiRelatedFileListItem>> = combineLatest([
    this._documentId$,
    this._refetch$,
  ]).pipe(
    tap(() => this.loading$.next(true)),
    switchMap(([documentId]) =>
      combineLatest([
        this.documentenApiDocumentService.getZakenApiDocuments(documentId),
        this.translateService.stream('key'),
      ])
    ),
    map(([relatedFiles]) => {
      const translatedFiles = relatedFiles?.map(file => ({
        ...file,
        createdBy: file.createdBy || this.translateService.instant('list.automaticallyGenerated'),
        language: this.translateService.instant(`document.${file.language}`),
        confidentialityLevel: this.translateService.instant(
          `document.${file.confidentialityLevel}`
        ),
        status: this.translateService.instant(`document.${file.status}`),
        format: this.translateService.instant(`document.${file.format}`),
      }));
      return translatedFiles || [];
    }),
    map(relatedFiles => this.fileSortService.sortRelatedFilesByDateDescending(relatedFiles)),
    map(relatedFiles => {
      moment.locale(this.translateService.currentLang);
      return relatedFiles.map(file => ({
        ...file,
        createdOn: moment(new Date(file.createdOn)).format('L'),
        size: `${this.bytesToMegabytes(file.sizeInBytes)}`,
      }));
    }),
    tap(() => {
      this.loading$.next(false);
    }),
    catchError(() => {
      this.showZaakLinkWarning = true;
      this.loading$.next(false);
      return of([]);
    })
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly uploadProviderService: UploadProviderService,
    private readonly downloadService: DownloadService,
    private readonly translateService: TranslateService,
    private readonly configService: ConfigService,
    private readonly userProviderService: UserProviderService,
    private readonly fileSortService: FileSortService,
    private readonly iconService: IconService,
    private readonly documentenApiDocumentService: DocumentenApiDocumentService
  ) {}

  ngOnInit(): void {
    this.refetchDocuments();
    this.setUploadProcessLinked();
    this.isUserAdmin();
    this.iconService.registerAll([Filter16, TagGroup16, Upload16]);
  }

  public ngAfterViewInit(): void {
    const fieldOptions = [
      {key: 'title', label: 'document.inputTitle'},
      {key: 'description', label: 'document.inputDescription'},
      {key: 'fileName', label: 'document.filename'},
      {
        viewType: ViewType.TEMPLATE,
        label: 'document.size',
        key: 'size',
        template: this.sizeTemplate,
      },
      {key: 'format', label: 'document.format'},
      {key: 'createdOn', label: 'document.createdOn'},
      {key: 'createdBy', label: 'document.createdBy'},
      {key: 'author', label: 'document.author'},
      {key: 'keywords', label: 'document.trefwoorden'},
      {key: 'informatieobjecttype', label: 'document.informatieobjecttype'},
      {key: 'language', label: 'document.language'},
      {key: 'identification', label: 'document.id'},
      {key: 'confidentialityLevel', label: 'document.confidentialityLevel'},
      {key: 'receiptDate', label: 'document.receiptDate'},
      {key: 'sendDate', label: 'document.sendDate'},
      {key: 'status', label: 'document.status'},
    ];

    this.fields = [...this.getFields(fieldOptions, this.fieldsConfig)];
  }

  public bytesToMegabytes(bytes: number): string {
    const megabytes = bytes / (1024 * 1024);
    if (megabytes < 1) {
      return `${Math.ceil(megabytes * 1000)} KB`;
    } else if (megabytes < 1000) {
      return megabytes.toFixed(2) + ' MB';
    }

    return (megabytes / 1000).toFixed(2) + ' GB';
  }

  public getUploadButtonTooltip(): string {
    if (this.uploadProcessLinkedSet && this.uploadProcessLinked) {
      return 'Upload';
    } else if (this.isAdmin) {
      return 'dossier.documenten.noProcessLinked.adminRole';
    }

    return 'dossier.documenten.noProcessLinked.regularUser';
  }

  public isUserAdmin() {
    this.userProviderService.getUserSubject().subscribe(
      userIdentity => {
        this.isAdmin = userIdentity.roles.includes('ROLE_ADMIN');
      },
      error => {
        this.isAdmin = false;
      }
    );
  }

  public metadataSet(metadata: DocumentenApiMetadata): void {
    this.uploading$.next(true);
    this.hideModal$.next(null);

    combineLatest([this.fileToBeUploaded$, this._documentId$])
      .pipe(take(1))
      .pipe(
        tap(([file, documentId]) => {
          if (!file) return;

          this.uploadProviderService
            .uploadFileWithMetadata(file, documentId, metadata)
            .subscribe(() => {
              this.refetchDocuments();
              this.uploading$.next(false);
              this.fileToBeUploaded$.next(null);
            });
        })
      )
      .subscribe();
  }

  public onDeleteActionClick(item: DocumentenApiRelatedFile): void {
    this.loading$.next(true);
    this.documentenApiDocumentService.deleteDocument(item).subscribe(() => {
      // TODO: Use refetchDocuments() or should we just remove the document from relatedFiles$?
      this.refetchDocuments();
    });
  }

  public onDownloadActionClick(file: DocumentenApiRelatedFile): void {
    this.downloadDocument(file, true);
  }

  public onFileSelected(event: any): void {
    this.fileToBeUploaded$.next(event.target.files[0]);
    this.showModal$.next(null);
  }

  public onNavigateToCaseAdminClick(): void {
    this._documentDefinitionName$.pipe(take(1)).subscribe(documentDefinitionName => {
      this.router.navigate([`/dossier-management/dossier/${documentDefinitionName}`]);
    });
  }

  public onRowClick(event: any): void {
    this.downloadDocument(event, false);
  }

  public onUploadButtonClick(): void {
    this.fileInput.nativeElement.click();
  }

  public refetchDocuments(): void {
    this._refetch$.next(null);
  }

  private downloadDocument(relatedFile: DocumentenApiRelatedFile, forceDownload: boolean): void {
    this.downloadService.downloadFile(
      `/api/v1/documenten-api/${relatedFile.pluginConfigurationId}/files/${relatedFile.fileId}/download`,
      relatedFile.fileName,
      forceDownload
    );
  }

  private getFields(fieldOptions, fieldsConfig) {
    return fieldOptions.filter(fieldOption => fieldsConfig.includes(fieldOption.key));
  }

  private setUploadProcessLinked(): void {
    this._documentDefinitionName$
      .pipe(
        switchMap(documentDefinitionName =>
          this.uploadProviderService.checkUploadProcessLink(documentDefinitionName)
        ),
        take(1),
        tap(() => {
          this.uploadProcessLinkedSet = true;
        })
      )
      .subscribe((linked: boolean) => {
        this.uploadProcessLinked = linked;
      });
  }
}
