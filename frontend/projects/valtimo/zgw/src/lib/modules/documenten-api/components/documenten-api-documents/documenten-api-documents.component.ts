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
import {CommonModule} from '@angular/common';
import {Component, ElementRef, OnDestroy, OnInit, TemplateRef, ViewChild} from '@angular/core';
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
  CAN_DELETE_RESOURCE_PERMISSION,
  CAN_MODIFY_RESOURCE_PERMISSION,
  CAN_VIEW_RESOURCE_PERMISSION,
  DownloadService,
  RESOURCE_PERMISSION_RESOURCE,
  UploadProviderService,
} from '@valtimo/resource';
import {UserProviderService} from '@valtimo/security';
import {ButtonModule, DialogModule, IconModule, IconService} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  Observable,
  of,
  ReplaySubject,
  Subject,
  Subscription,
} from 'rxjs';
import {catchError, filter, map, switchMap, take, tap} from 'rxjs/operators';
import {
  COLUMN_VIEW_TYPES,
  ConfiguredColumn,
  DOCUMENTEN_COLUMN_KEYS,
  DocumentenApiFilterModel,
  DocumentenApiRelatedFile,
  SupportedDocumentenApiFeatures,
} from '../../models';
import {DocumentenApiColumnService, DocumentenApiVersionService} from '../../services';
import {DocumentenApiDocumentService} from '../../services/documenten-api-document.service';
import {DocumentenApiFilterComponent} from '../documenten-api-filter/documenten-api-filter.component';
import {DocumentenApiMetadataModalComponent} from '../documenten-api-metadata-modal/documenten-api-metadata-modal.component';
import {
  DocumentenApiUploadFieldDefaultValues,
  DocumentenApiUploadFields,
} from '../../models/documenten-api-upload-field.model';
import {PermissionRequest, PermissionService} from '@valtimo/access-control';

@Component({
  selector: 'valtimo-case-detail-tab-documenten-api-documents',
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
export class CaseDetailTabDocumentenApiDocumentsComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput: ElementRef;
  @ViewChild('translationTemplate') translationTemplate: TemplateRef<any>;

  private readonly _caseDefinitionKey$ = this.route.params.pipe(
    map(params => params?.caseDefinitionKey ?? ''),
    filter((caseDefinitionKey: string) => !!caseDefinitionKey)
  );

  public readonly supportedDocumentenApiFeatures$ =
    new BehaviorSubject<SupportedDocumentenApiFeatures | null>(null);

  private readonly _supportedDocumentenApiFeatures$: Observable<SupportedDocumentenApiFeatures> =
    this._caseDefinitionKey$.pipe(
      switchMap(caseDefinitionName =>
        this.documentenApiVersionService.getSupportedApiFeatures(caseDefinitionName)
      ),
      tap(supportedDocumentenApiFeatures =>
        this.supportedDocumentenApiFeatures$.next(supportedDocumentenApiFeatures)
      )
    );

  public readonly fields$: Observable<ColumnConfig[]> = this._caseDefinitionKey$.pipe(
    tap(() => this.fieldsLoading$.next(true)),
    switchMap(caseDefinitionKey =>
      combineLatest([
        this.documentenApiColumnService.getConfiguredColumns(caseDefinitionKey),
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
    })
  );

  public readonly enablePbacDocumentenApiDocuments$: Observable<boolean> =
    this.configService.getFeatureToggleObservable('enablePbacDocumentenApiDocuments');

  public filePermissions: {
    [fileId: string]: {canView: boolean; canModify: boolean; canDelete: boolean};
  } = {};

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
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly uploadProviderService: UploadProviderService,
    private readonly downloadService: DownloadService,
    private readonly translateService: TranslateService,
    private readonly configService: ConfigService,
    private readonly userProviderService: UserProviderService,
    private readonly iconService: IconService,
    private readonly documentenApiDocumentService: DocumentenApiDocumentService,
    private readonly documentenApiColumnService: DocumentenApiColumnService,
    private readonly documentenApiVersionService: DocumentenApiVersionService,
    private readonly permissionService: PermissionService
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
      this.relatedFiles$
        .pipe(
          switchMap(files =>
            combineLatest({
              files: of(files),
              canView: this.getPermissions(files, CAN_VIEW_RESOURCE_PERMISSION),
              canModify: this.getPermissions(files, CAN_MODIFY_RESOURCE_PERMISSION),
              canDelete: this.getPermissions(files, CAN_DELETE_RESOURCE_PERMISSION),
            })
          )
        )
        .subscribe(permissions =>
          permissions.files.map(
            file =>
              (this.filePermissions[file.fileId] = {
                canView: permissions.canView[file.fileId],
                canModify: permissions.canModify[file.fileId],
                canDelete: permissions.canDelete[file.fileId],
              })
          )
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
    this._itemsLoading$.next(true);
    this.documentenApiDocumentService.deleteDocument(this.document).subscribe(() => {
      this.refetchDocuments();
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
      return 'case.documenten.noProcessLinked.adminRole';
    }

    return 'case.documenten.noProcessLinked.regularUser';
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
    this.uploading$.next(true);

    combineLatest([this.fileToBeUploaded$, this.documentId$])
      .pipe(take(1))
      .pipe(
        tap(([file, documentId]) => {
          if (!file) return;
          if (this.isEditMode$.getValue()) {
            this.documentenApiDocumentService.updateDocument(file, metadata).subscribe(() => {
              this.refetchDocuments();
              this.uploading$.next(false);
              this.fileToBeUploaded$.next(null);
            });
          } else {
            this.uploadProviderService
              .uploadFileWithMetadata(file, documentId, metadata)
              .subscribe(() => {
                this.refetchDocuments();
                this.filter$.next(null);
                this.pagination$.next(DEFAULT_PAGINATION);
                this.uploading$.next(false);
                this.fileToBeUploaded$.next(null);
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
    this.showUploadModal$.next(false);
  }

  public onFileSelected(event: any): void {
    this.isEditMode$.next(false);
    this.fileToBeUploaded$.next(event.target.files[0]);
    this.showUploadModal$.next(true);
    this.resetFileInput();
  }

  public onNavigateToCaseAdminClick(): void {
    this._caseDefinitionKey$.pipe(take(1)).subscribe((caseDefinitionKey: string) => {
      this.router.navigate([`/case-management/case/${caseDefinitionKey}`]);
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
    this.downloadService.downloadFile(
      `${this.valtimoEndpointUri}v1/documenten-api/${relatedFile.pluginConfigurationId}/files/${relatedFile.fileId}/download`,
      relatedFile.bestandsnaam ?? '',
      forceDownload
    );
  }

  private openQueryParamsSubscription(): void {
    this._subscriptions.add(
      combineLatest([
        this._caseDefinitionKey$,
        this.documentId$,
        this.filter$,
        this._sort$,
        this.pagination$,
      ]).subscribe(([definitionName, documentId, filter, sort, pagination]) => {
        const {size, page} = pagination;
        this.router.navigate([`/cases/${definitionName}/document/${documentId}/documents`], {
          queryParams: {...filter, ...sort, size, page: page - 1},
        });
      })
    );
  }

  private resetFileInput(): void {
    this.fileInput.nativeElement.value = '';
  }

  private setUploadProcessLinked(): void {
    this._caseDefinitionKey$
      .pipe(
        switchMap(caseDefinitionKey =>
          this.uploadProviderService.checkUploadProcessLink(caseDefinitionKey)
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

  private getPermissions(
    files: DocumentenApiRelatedFile[],
    permissionRequest: PermissionRequest
  ): Observable<{
    [key: string]: boolean;
  }> {
    return combineLatest(
      files.map(file =>
        this.getPermission(permissionRequest, {
          resource: RESOURCE_PERMISSION_RESOURCE.resourcePermission,
          identifier: file.fileId,
        }).pipe(map(available => ({[file.fileId]: available})))
      )
    ).pipe(
      map(permissions => permissions.reduce((acc, permission) => ({...acc, ...permission}), {}))
    );
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
