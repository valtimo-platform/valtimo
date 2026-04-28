/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
import {CommonModule} from '@angular/common';
import {HttpErrorResponse} from '@angular/common/http';
import {Component, ElementRef, OnDestroy, OnInit, signal, TemplateRef, ViewChild,} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Filter16, TagGroup16, Upload16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  ActionItem,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  DEFAULT_PAGINATION,
  DEFAULT_PAGINATOR_CONFIG,
  DocumentenApiMetadata,
  Pagination,
  SortState,
  ViewType,
} from '@valtimo/components';
import {ConfigService, Direction} from '@valtimo/config';
import {
  CAN_CREATE_RESOURCE_PERMISSION,
  DownloadService,
  RESOURCE_PERMISSION_RESOURCE,
  UploadProviderService,
} from '@valtimo/resource';
import {UserProviderService} from '@valtimo/security';
import {ButtonModule, DialogModule, IconModule, IconService} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, Observable, of, ReplaySubject, Subject, Subscription,} from 'rxjs';
import {catchError, filter, map, shareReplay, switchMap, take, tap} from 'rxjs/operators';
import {
  COLUMN_VIEW_TYPES,
  ConfiguredColumn,
  DOCUMENTEN_COLUMN_KEYS,
  DocumentenApiFilePermissions,
  DocumentenApiFilterModel,
  DocumentenApiRelatedFile,
  SupportedDocumentenApiFeatures,
} from '../../models';
import {DocumentenApiColumnService, DocumentenApiDocumentService, DocumentenApiVersionService} from '../../services';
import {DocumentenApiFilterComponent} from '../documenten-api-filter/documenten-api-filter.component';
import {
  DocumentenApiMetadataModalComponent
} from '../documenten-api-metadata-modal/documenten-api-metadata-modal.component';
import {
  DocumentenApiUploadFieldDefaultValues,
  DocumentenApiUploadFields,
} from '../../models/documenten-api-upload-field.model';
import {PermissionRequest, PermissionService} from '@valtimo/access-control';

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
    DocumentenApiFilterComponent,
    DialogModule,
    ConfirmationModalModule,
  ],
})
export class DossierDetailTabDocumentenApiDocumentsComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput: ElementRef;
  @ViewChild('translationTemplate') translationTemplate: TemplateRef<any>;

  private readonly _documentDefinitionName$ = this.route.params.pipe(
    map(params => params?.documentDefinitionName),
    filter(caseDefinitionName => !!caseDefinitionName)
  );

  public readonly supportedDocumentenApiFeatures$ =
    new BehaviorSubject<SupportedDocumentenApiFeatures | null>(null);

  private readonly _supportedDocumentenApiFeatures$: Observable<SupportedDocumentenApiFeatures> =
    this._documentDefinitionName$.pipe(
      switchMap(caseDefinitionName =>
        this.documentenApiVersionService.getSupportedApiFeatures(caseDefinitionName)
      ),
      tap(supportedDocumentenApiFeatures =>
        this.supportedDocumentenApiFeatures$.next(supportedDocumentenApiFeatures)
      )
    );

  public readonly fields$: Observable<ColumnConfig[]> = this._documentDefinitionName$.pipe(
    tap(() => this.fieldsLoading$.next(true)),
    switchMap(documentDefinitionName =>
      combineLatest([
        this.documentenApiColumnService.getConfiguredColumns(documentDefinitionName),
        this._supportedDocumentenApiFeatures$,
        this._sort$,
      ])
    ),
    map(([columns, supportedDocumentenApiFeatures, sort]) => {
      const defaultSortColumn: ConfiguredColumn | undefined = columns.find(
        (column: ConfiguredColumn) => !!column.defaultSort
      );
      if (
        !!defaultSortColumn &&
        !sort?.sort &&
        supportedDocumentenApiFeatures.supportsSortableColumns
      ) {
        this._sort$.next({sort: `${defaultSortColumn.key},${defaultSortColumn.defaultSort}`});
      }

      return columns.map((column: ConfiguredColumn) => ({
        key: column.key === DOCUMENTEN_COLUMN_KEYS.BESTANDSOMVANG ? 'size' : column.key,
        label: `zgw.documentColumns.${column.key}`,
        viewType: !COLUMN_VIEW_TYPES[column.key] ? ViewType.TEXT : COLUMN_VIEW_TYPES[column.key],
        ...(COLUMN_VIEW_TYPES[column.key] === ViewType.TEMPLATE && {
          template: this.translationTemplate,
          templateData: {key: column.key},
        }),
        ...(column.key === DOCUMENTEN_COLUMN_KEYS.CREATIEDATUM && {format: 'DD-MM-YYYY'}),
        sortable: column.sortable && supportedDocumentenApiFeatures.supportsSortableColumns,
      }));
    }),
    tap(() => this.fieldsLoading$.next(false))
  );
  public document: DocumentenApiRelatedFile;
  public actionItems: ActionItem[] = [
    {
      label: 'document.download',
      callback: this.onDownloadActionClick.bind(this),
      disabledCallback: this.downloadDisabled.bind(this),
      type: 'normal',
    },
    {
      label: 'document.edit',
      callback: this.onEditMetadata.bind(this),
      disabledCallback: this.editDisabled.bind(this),
      type: 'normal',
    },
    {
      label: 'document.delete',
      callback: this.onDeleteActionClick.bind(this),
      disabledCallback: this.deleteDisabled.bind(this),
      type: 'danger',
    },
  ];

  public readonly documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params?.documentDefinitionName),
    filter(documentDefinitionName => !!documentDefinitionName)
  );

  public readonly documentId$: Observable<string> = this.route.params.pipe(
    map(params => params?.documentId),
    filter(documentId => !!documentId)
  );

  public isAdmin: boolean;
  public showZaakLinkWarning: boolean;
  public uploadProcessLinkedSet = false;
  public uploadProcessLinked!: boolean;

  public isEditMode$ = new BehaviorSubject<boolean>(false);

  public readonly acceptedFiles: string | null =
    this.configService?.config?.caseFileUploadAcceptedFiles || null;
  public readonly maxFileSize: number = this.configService?.config?.caseFileSizeUploadLimitMB || 5;

  public readonly fileToBeUploaded$ = new BehaviorSubject<File | null>(null);
  public readonly modalDisabled$ = new BehaviorSubject<boolean>(false);
  public readonly showModal$ = new Subject<null>();
  public readonly showUploadModal$ = new BehaviorSubject<boolean>(false);
  public readonly uploadError = signal<string | null>(null);
  public readonly showDeleteConfirmationModal$ = new BehaviorSubject<boolean>(false);

  public readonly uploading$ = new BehaviorSubject<boolean>(false);
  private readonly _itemsLoading$ = new BehaviorSubject<boolean>(true);
  public readonly fieldsLoading$ = new BehaviorSubject<boolean>(true);
  public readonly loading$ = combineLatest([this._itemsLoading$, this.fieldsLoading$]).pipe(
    map(([itemsLoading, fieldsLoading]) => itemsLoading || fieldsLoading)
  );

  public readonly filter$ = new ReplaySubject<DocumentenApiFilterModel | null>();
  public readonly pagination$ = new BehaviorSubject<Pagination>(DEFAULT_PAGINATION);
  private readonly _refetch$ = new BehaviorSubject<null>(null);
  private readonly _sort$ = new ReplaySubject<{sort: string} | null>();
  private readonly valtimoEndpointUri!: string;

  public readonly paginatorConfig = {
    ...DEFAULT_PAGINATOR_CONFIG,
    itemsPerPageOptions: [5, 10, 20, 50, 100],
  };

  public sortState$: Observable<SortState | null> = this._sort$.pipe(
    filter(sortValue => !!sortValue?.sort),
    map(sortValue => this.getSortStateFromSortString(sortValue?.sort))
  );

  public uploadFields$: Observable<DocumentenApiUploadFields> = this.documentId$.pipe(
    switchMap(documentId => this.documentenApiDocumentService.getPrefilledUploadFields(documentId)),
    map(uploadFields =>
      uploadFields.reduce(
        (acc, curr) => ({
          ...acc,
          [curr.key]: {
            key: curr.key,
            defaultValue: curr.defaultValue,
            visible: curr.visible,
            readonly: curr.readonly,
          },
        }),
        {}
      )
    )
  );

  public defaultValues$: Observable<DocumentenApiUploadFieldDefaultValues> =
    this.uploadFields$.pipe(
      map(formFields => ({
        auteur: formFields?.auteur?.defaultValue,
        vertrouwelijkheidaanduiding: formFields?.vertrouwelijkheidaanduiding?.defaultValue,
        beschrijving: formFields?.beschrijving?.defaultValue,
        titel: formFields?.titel?.defaultValue,
        informatieobjecttype: formFields?.informatieobjecttype?.defaultValue,
        bestandsnaam: formFields?.bestandsnaam?.defaultValue,
        taal: formFields?.taal?.defaultValue,
        status: formFields?.status?.defaultValue,
        trefwoorden: formFields?.trefwoorden?.defaultValue
          ?.split(',')
          ?.map(tag => tag.trim())
          ?.filter(tag => !!tag),
      }))
    );

  public hideFields$: Observable<Array<string>> = this.uploadFields$.pipe(
    map(formFields => {
      if (formFields) {
        return Object.keys(formFields).filter(field => !formFields[field]?.visible);
      }
      return [];
    })
  );

  public relatedFiles$: Observable<Array<DocumentenApiRelatedFile>> = combineLatest([
    this.documentId$,
    this.route.queryParamMap,
    this._refetch$,
  ]).pipe(
    tap(() => this._itemsLoading$.next(true)),
    switchMap(([documentId, queryParams]) =>
      combineLatest([
        this.documentenApiDocumentService.getFilteredZakenApiDocuments(
          documentId,
          queryParams['params']
        ),
        this.translateService.stream('key'),
      ])
    ),
    map(([relatedFiles]) => {
      this.pagination$.next({
        ...this.pagination$.getValue(),
        collectionSize: relatedFiles.totalElements,
      });
      const translatedFiles = relatedFiles?.content?.map(file => ({
        ...file,
        createdBy: file.createdBy || this.translateService.instant('list.automaticallyGenerated'),
        size: this.bytesToMegabytes(file.bestandsomvang),
        tags: file.trefwoorden?.map((trefwoord: string) => ({
          content: trefwoord,
        })),
      }));
      return translatedFiles || [];
    }),
    tap(() => {
      this._itemsLoading$.next(false);
    }),
    catchError(() => {
      this.showZaakLinkWarning = true;
      this._itemsLoading$.next(false);
      return of([]);
    }),
    shareReplay({bufferSize: 1, refCount: true})
  );

  public readonly enablePbacDocumentenApiDocuments$: Observable<boolean> =
    this.configService.getFeatureToggleObservable('enablePbacDocumentenApiDocuments');

  public filePermissions$ = new BehaviorSubject<DocumentenApiFilePermissions>({});

  public get filePermissions(): DocumentenApiFilePermissions {
    return this.filePermissions$.getValue();
  }

  public readonly canCreateResource$: Observable<boolean> = this.documentId$.pipe(
    switchMap(documentId =>
      this.getPermission(CAN_CREATE_RESOURCE_PERMISSION, {
        resource: RESOURCE_PERMISSION_RESOURCE.jsonSchemaDocument,
        identifier: documentId,
      })
    )
  );

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly configService: ConfigService,
    private readonly documentenApiColumnService: DocumentenApiColumnService,
    private readonly documentenApiDocumentService: DocumentenApiDocumentService,
    private readonly documentenApiVersionService: DocumentenApiVersionService,
    private readonly downloadService: DownloadService,
    private readonly iconService: IconService,
    private readonly permissionService: PermissionService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly translateService: TranslateService,
    private readonly uploadProviderService: UploadProviderService,
    private readonly userProviderService: UserProviderService
  ) {
    this.iconService.register(Filter16);
    this.valtimoEndpointUri = configService.config.valtimoApi.endpointUri;
  }

  public ngOnInit(): void {
    this.setInitialParams();
    this.setUploadProcessLinked();
    this.isUserAdmin();
    this.iconService.registerAll([Filter16, TagGroup16, Upload16]);
    this.registerPermissionSubscriptions();
  }

  public registerPermissionSubscriptions(): void {
    this._subscriptions.add(
      combineLatest([this.relatedFiles$, this.enablePbacDocumentenApiDocuments$]).subscribe(
        ([files, pbacEnabled]) => {
          const permissions: DocumentenApiFilePermissions = {};
          files.forEach(file => {
            permissions[file.fileId] = {
              canView: pbacEnabled ? file.canView !== false : true,
              canModify: pbacEnabled ? file.canModify !== false : true,
              canDelete: pbacEnabled ? file.canDelete !== false : true,
            };
          });
          this.filePermissions$.next(permissions);
        }
      )
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onDeleteActionClick(item: DocumentenApiRelatedFile): void {
    this.document = item;
    this.showDeleteConfirmationModal$.next(true);
  }

  public deleteDocument(): void {
    this.documentId$.pipe(take(1)).subscribe(documentId => {
      this._itemsLoading$.next(true);
      this.documentenApiDocumentService.deleteDocument(this.document, documentId).subscribe({
        next: () => {
          this.refetchDocuments();
        },
        error: () => {
          this._itemsLoading$.next(false);
        },
      });
    });
  }

  public bytesToMegabytes(bytes: number | undefined): string {
    if (!bytes) return '';

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
    this.userProviderService
      .getUserSubject()
      .pipe(take(1))
      .subscribe(
        userIdentity => {
          this.isAdmin = userIdentity.roles.includes('ROLE_ADMIN');
        },
        () => {
          this.isAdmin = false;
        }
      );
  }

  public metadataSet(metadata: DocumentenApiMetadata): void {
    this.uploadError.set(null);
    this.uploading$.next(true);

    combineLatest([this.fileToBeUploaded$, this.documentId$])
      .pipe(take(1))
      .pipe(
        tap(([file, documentId]) => {
          if (!file) return;
          if (this.isEditMode$.getValue()) {
            this.documentenApiDocumentService.updateDocument(file, metadata, documentId).subscribe({
              next: () => {
                this.showUploadModal$.next(false);
                this.refetchDocuments();
                this.uploading$.next(false);
                this.fileToBeUploaded$.next(null);
              },
              error: (error: HttpErrorResponse) => {
                this.uploading$.next(false);
                if (error.status === 403) {
                  this.uploadError.set(
                    this.translateService.instant('document.uploadPermissionDenied')
                  );
                } else {
                  this.showUploadModal$.next(false);
                }
              },
            });
          } else {
            this.uploadProviderService
              .uploadFileWithMetadata(file, documentId, metadata)
              .subscribe({
                next: () => {
                  this.showUploadModal$.next(false);
                  this.refetchDocuments();
                  this.filter$.next(null);
                  this.pagination$.next(DEFAULT_PAGINATION);
                  this.uploading$.next(false);
                  this.fileToBeUploaded$.next(null);
                },
                error: (error: HttpErrorResponse) => {
                  this.uploading$.next(false);
                  if (error.status === 403) {
                    this.uploadError.set(
                      this.translateService.instant('document.uploadPermissionDenied')
                    );
                  } else {
                    this.showUploadModal$.next(false);
                  }
                },
              });
          }
        })
      )
      .subscribe();
  }

  public onDownloadActionClick(file: DocumentenApiRelatedFile): void {
    this.downloadDocument(file, true);
  }

  public onEditMetadata(file: File): void {
    this.isEditMode$.next(true);
    this.fileToBeUploaded$.next(file);
    this.showUploadModal$.next(true);
  }

  public closeMetadataModal(): void {
    this.uploadError.set(null);
    this.showUploadModal$.next(false);
  }

  public onFileSelected(event: any): void {
    this.isEditMode$.next(false);
    this.fileToBeUploaded$.next(event.target.files[0]);
    this.showUploadModal$.next(true);
    this.resetFileInput();
  }

  public onNavigateToCaseAdminClick(): void {
    this.documentDefinitionName$.pipe(take(1)).subscribe(documentDefinitionName => {
      this.router.navigate([`/dossier-management/dossier/${documentDefinitionName}`]);
    });
  }

  public onRowClick(event: any): void {
    if (this.filePermissions[event.fileId]?.canView) {
      this.downloadDocument(event, false);
    }
  }

  public onPaginationClicked(page: number): void {
    this.pagination$.next({...this.pagination$.getValue(), page});
  }

  public onPaginationSet(size: number): void {
    const {collectionSize, page} = this.pagination$.getValue();
    const resetPage: boolean = Math.ceil(+collectionSize / size) <= +page && +collectionSize > 0;
    this.pagination$.next({...this.pagination$.getValue(), size, ...(resetPage && {page: 1})});
  }

  public onUploadButtonClick(): void {
    this.fileInput.nativeElement.click();
  }

  public onFilterEvent(filter: DocumentenApiFilterModel | null): void {
    this.filter$.next(filter);
    this.pagination$.next({...this.pagination$.getValue(), ...DEFAULT_PAGINATION});
  }

  public onSortChanged(sortState: SortState): void {
    this._sort$.next(
      sortState.isSorting
        ? {
            sort: `${sortState.state.name === 'size' ? DOCUMENTEN_COLUMN_KEYS.BESTANDSOMVANG : sortState.state.name},${sortState.state.direction}`,
          }
        : null
    );
  }

  public refetchDocuments(): void {
    this._refetch$.next(null);
  }

  private downloadDisabled(file: DocumentenApiRelatedFile): boolean {
    return !this.filePermissions[file.fileId]?.canView;
  }

  private editDisabled(file: DocumentenApiRelatedFile): boolean {
    return (
      (!this.supportedDocumentenApiFeatures$.value.supportsUpdatingDefinitiveDocument &&
        file.status === 'definitief') ||
      !this.filePermissions[file.fileId]?.canModify
    );
  }

  private deleteDisabled(file: DocumentenApiRelatedFile): boolean {
    return !this.filePermissions[file.fileId]?.canDelete;
  }

  private downloadDocument(relatedFile: DocumentenApiRelatedFile, forceDownload: boolean): void {
    this.documentId$.pipe(take(1)).subscribe(documentId => {
      this.downloadService.downloadFile(
        `${this.valtimoEndpointUri}v1/zaken-api/${relatedFile.pluginConfigurationId}/case-document/${documentId}/files/${relatedFile.fileId}/download`,
        relatedFile.bestandsnaam ?? '',
        forceDownload
      );
    });
  }

  private openQueryParamsSubscription(): void {
    this._subscriptions.add(
      combineLatest([
        this.documentDefinitionName$,
        this.documentId$,
        this.filter$,
        this._sort$,
        this.pagination$,
      ]).subscribe(([definitionName, documentId, filter, sort, pagination]) => {
        const {size, page} = pagination;
        this.router.navigate([`/dossiers/${definitionName}/document/${documentId}/documents`], {
          queryParams: {...filter, ...sort, size, page: page - 1},
        });
      })
    );
  }

  private resetFileInput(): void {
    this.fileInput.nativeElement.value = '';
  }

  private setUploadProcessLinked(): void {
    this.documentDefinitionName$
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

  private setInitialParams(): void {
    this.route.queryParamMap
      .pipe(
        take(1),
        map(queryParams => {
          const {sort, size, page, ...filter} = queryParams['params'];
          return {sort, filter, size, page};
        })
      )
      .subscribe(({filter, sort, size, page}) => {
        this._sort$.next({sort});
        this.filter$.next(filter);
        this.pagination$.next({
          ...this.pagination$.getValue(),
          size: +size,
          page: +(page ?? 0) + 1,
        });
        this.openQueryParamsSubscription();
      });
  }

  private getSortStateFromSortString(sortString?: string): SortState | null {
    const splitString = sortString && sortString.split(',');
    if (splitString && splitString?.length > 1) {
      return {
        isSorting: true,
        state: {
          name: splitString[0],
          direction: splitString[1] as Direction,
        },
      };
    }

    return null;
  }

  private getPermission(permissionRequest: PermissionRequest, context?: any): Observable<boolean> {
    return this.enablePbacDocumentenApiDocuments$.pipe(
      switchMap(enabled => {
        if (!enabled) {
          return of(true);
        }
        return this.permissionService.requestPermission(permissionRequest, context);
      })
    );
  }
}
