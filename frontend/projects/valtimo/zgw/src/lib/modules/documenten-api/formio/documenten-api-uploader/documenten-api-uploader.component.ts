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

import {Component, EventEmitter, Input, OnDestroy, OnInit, Output, signal} from '@angular/core';
import {
  FormioCustomComponent,
  FormIoDomService,
  FormIoStateService,
  ValtimoModalService,
} from '@valtimo/components';
import {
  BehaviorSubject,
  combineLatest,
  Observable,
  of,
  startWith,
  Subscription,
  switchMap,
} from 'rxjs';
import {
  DocumentenApiFileReference,
  DownloadService,
  UploadProviderService,
} from '@valtimo/resource';
import {DocumentenApiMetadata, SupportedDocumentenApiFeatures} from '../../models';
import {filter, map, take, tap} from 'rxjs/operators';
import {UserProviderService} from '@valtimo/security';
import {ActivatedRoute} from '@angular/router';
import {DocumentenApiVersionService} from '../../services';

@Component({
  selector: 'valtimo-documenten-api-formio-uploader',
  templateUrl: './documenten-api-uploader.component.html',
  styleUrls: ['./documenten-api-uploader.component.scss'],
})
export class DocumentenApiUploaderComponent
  implements FormioCustomComponent<Array<DocumentenApiFileReference>>, OnInit, OnDestroy
{
  @Input() disabled: boolean;
  @Input() title: string;
  @Input() hideTitle: boolean;
  @Input() subtitle: string;
  @Input() maxFileSize: number;
  @Input() hideMaxFileSize: boolean;
  @Input() camera: boolean;

  @Input() set documentTitle(defaultValue: string) {
    this.defaultValues['titel'] = defaultValue;
  }

  @Input() set hideDocumentTitle(hide: boolean) {
    this.hideField(hide, 'titel');
  }

  @Input() disableDocumentTitle: boolean;

  @Input() set filename(defaultValue: string) {
    this.defaultValues['bestandsnaam'] = defaultValue;
  }

  @Input() set hideFilename(hide: boolean) {
    this.hideField(hide, 'bestandsnaam');
  }

  @Input() disableFilename: boolean;

  @Input() set author(defaultValue: string) {
    this.defaultValues['auteur'] = defaultValue;
  }

  @Input() set hideAuthor(hide: boolean) {
    this.hideField(hide, 'auteur');
  }

  @Input() disableAuthor: boolean;

  @Input() set status(defaultValue: string) {
    this.defaultValues['status'] = defaultValue;
  }

  @Input() set hideStatus(hide: boolean) {
    this.hideField(hide, 'status');
  }

  @Input() disableStatus: boolean;

  @Input() set language(defaultValue: string) {
    this.defaultValues['taal'] = defaultValue;
  }

  @Input() set hideLanguage(hide: boolean) {
    this.hideField(hide, 'taal');
  }

  @Input() disableLanguage: boolean;

  @Input() set documentType(defaultValue: string) {
    this.defaultValues['informatieobjecttype'] = defaultValue;
  }

  @Input() set hideDocumentType(hide: boolean) {
    this.hideField(hide, 'informatieobjecttype');
  }

  @Input() disableDocumentType: boolean;

  @Input() set description(defaultValue: string) {
    this.defaultValues['beschrijving'] = defaultValue;
  }

  @Input() set hideDescription(hide: boolean) {
    this.hideField(hide, 'beschrijving');
  }

  @Input() disableDescription: boolean;

  @Input() set confidentialityLevel(defaultValue: string) {
    this.defaultValues['vertrouwelijkheidaanduiding'] = defaultValue;
  }

  @Input() set hideConfidentialityLevel(hide: boolean) {
    this.hideField(hide, 'vertrouwelijkheidaanduiding');
  }

  @Input() disableConfidentialityLevel: boolean;

  @Input() set hideCreationDate(hide: boolean) {
    this.hideField(hide, 'creatiedatum');
  }

  @Input() disableCreationDate: boolean;

  @Input() set hideAdditionalDate(hide: boolean) {
    this.hideField(hide, 'aanvullendeDatum');
  }

  @Input() set tags(tags: string) {
    let _tags = tags
      ?.split(',')
      ?.map(tag => tag.trim())
      ?.filter(tag => !!tag);
    if (_tags?.length === 0) {
      _tags = null;
    }
    this.defaultValues['trefwoorden'] = tags;
  }

  @Input() set hideTags(hide: boolean) {
    this.hideField(hide, 'trefwoorden');
  }

  @Output() valueChange = new EventEmitter<Array<DocumentenApiFileReference>>();

  readonly uploading$ = new BehaviorSubject<boolean>(false);
  readonly fileToBeUploaded$ = new BehaviorSubject<File | null>(null);
  readonly modalDisabled$ = new BehaviorSubject<boolean>(false);
  readonly showModal = signal<boolean>(false);
  readonly uploadProcessLinked$: Observable<boolean | string> =
    this.modalService.documentDefinitionName$.pipe(
      switchMap(documentDefinitionName =>
        this.uploadProviderService.checkUploadProcessLink(documentDefinitionName)
      ),
      startWith('loading')
    );
  readonly isAdmin$: Observable<boolean> = this.userProviderService
    .getUserSubject()
    .pipe(map(userIdentity => userIdentity?.roles.includes('ROLE_ADMIN')));

  public readonly supportedDocumentenApiFeatures$: Observable<SupportedDocumentenApiFeatures> =
    this.modalService.documentDefinitionName$.pipe(
      switchMap(caseDefinitionName =>
        this.documentenApiVersionService.getSupportedApiFeatures(caseDefinitionName)
      )
    );

  public defaultValues: {} = {};
  public hideFields: Array<string> = [];

  private _subscriptions = new Subscription();

  constructor(
    private readonly uploadProviderService: UploadProviderService,
    private readonly stateService: FormIoStateService,
    private readonly domService: FormIoDomService,
    private readonly downloadService: DownloadService,
    private readonly modalService: ValtimoModalService,
    private readonly userProviderService: UserProviderService,
    private readonly route: ActivatedRoute,
    private readonly documentenApiVersionService: DocumentenApiVersionService
  ) {}

  public ngOnInit(): void {
    this.openDocumentDefinitionSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  _value: Array<DocumentenApiFileReference> = [];

  public get value(): Array<DocumentenApiFileReference> {
    return this._value;
  }

  @Input()
  public set value(value: Array<DocumentenApiFileReference>) {
    if (Array.isArray(value)) {
      this._value = value;
    }
  }

  fileSelected(file: File): void {
    this.fileToBeUploaded$.next(file);
    this.showModal.set(true);
  }

  deleteFile(id: string): void {
    this.domService.toggleSubmitButton(true);
    this._value = this._value.filter((file: DocumentenApiFileReference) =>
      file?.id ? file?.id !== id : true
    );
    this.valueChange.emit(this._value);
  }

  closeMetadataModal(): void {
    this.showModal.set(false);
  }

  metadataSet(metadata: DocumentenApiMetadata): void {
    this.uploading$.next(true);
    this.showModal.set(false);
    this.domService.toggleSubmitButton(true);

    this.fileToBeUploaded$
      .pipe(
        take(1),
        switchMap(file => this.uploadProviderService.uploadTempFileWithMetadata(file, metadata)),
        tap(result => {
          this.domService.toggleSubmitButton(false);
          this.uploading$.next(false);
          this._value.push(result);
          this.valueChange.emit(this._value);
        })
      )
      .subscribe();
  }

  private openDocumentDefinitionSubscription() {
    this._subscriptions.add(
      combineLatest([this.route?.params || of(null), this.route?.firstChild?.params || of(null)])
        .pipe(
          map(
            ([params, firstChildParams]) =>
              (params?.documentDefinitionName || firstChildParams?.documentDefinitionName) as string
          ),
          filter(documentDefinitionName => !!documentDefinitionName)
        )
        .subscribe(documentDefinitionName =>
          this.modalService.setDocumentDefinitionName(documentDefinitionName)
        )
    );
  }

  private hideField(hide: boolean, field: string) {
    const exists = this.hideFields.includes(field);
    if (!exists && hide) {
      this.hideFields.push(field);
    } else if (exists && !hide) {
      delete this.hideFields[field];
    }
  }
}
