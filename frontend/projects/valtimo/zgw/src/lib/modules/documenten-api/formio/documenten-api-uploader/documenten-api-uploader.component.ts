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

import {Component, EventEmitter, Input, Output, signal} from '@angular/core';
import {
  FormioCustomComponent,
  FormIoDomService,
  FormIoStateService,
  ValtimoModalService,
} from '@valtimo/components';
import {BehaviorSubject, combineLatest, Observable, of, startWith, switchMap} from 'rxjs';
import {
  DocumentenApiFileReference,
  DownloadService,
  UploadProviderService,
} from '@valtimo/resource';
import {DocumentenApiMetadata} from '../../models';
import {filter, map, take, tap} from 'rxjs/operators';
import {UserProviderService} from '@valtimo/security';
import {ActivatedRoute} from '@angular/router';

@Component({
  selector: 'valtimo-documenten-api-formio-uploader',
  templateUrl: './documenten-api-uploader.component.html',
  styleUrls: ['./documenten-api-uploader.component.scss'],
})
export class DocumentenApiUploaderComponent
  implements FormioCustomComponent<Array<DocumentenApiFileReference>>
{
  @Input() disabled: boolean;
  @Input() title: string;
  @Input() hideTitle: boolean;
  @Input() subtitle: string;
  @Input() maxFileSize: number;
  @Input() hideMaxFileSize: boolean;
  @Input() camera: boolean;

  @Input() documentTitle: string;
  @Input() disableDocumentTitle: boolean;
  @Input() filename: string;
  @Input() disableFilename: boolean;
  @Input() author: string;
  @Input() disableAuthor: boolean;
  @Input() status: string;
  @Input() disableStatus: boolean;
  @Input() language: string;
  @Input() disableLanguage: boolean;
  @Input() documentType: string;
  @Input() disableDocumentType: boolean;
  @Input() description: string;
  @Input() disableDescription: boolean;
  @Input() confidentialityLevel: string;
  @Input() disableConfidentialityLevel: boolean;

  @Output() valueChange = new EventEmitter<Array<DocumentenApiFileReference>>();

  readonly uploading$ = new BehaviorSubject<boolean>(false);
  readonly fileToBeUploaded$ = new BehaviorSubject<File | null>(null);
  readonly modalDisabled$ = new BehaviorSubject<boolean>(false);
  readonly showModal = signal<boolean>(false);
  readonly uploadProcessLinked$: Observable<boolean | string> = combineLatest([
    this.route?.params || of(null),
    this.route?.firstChild?.params || of(null),
    this.modalService.documentDefinitionName$,
  ]).pipe(
    filter(
      ([params, firstChildParams, documentDefinitionName]) =>
        !!(
          params?.documentDefinitionName ||
          firstChildParams?.documentDefinitionName ||
          documentDefinitionName
        )
    ),
    switchMap(([params, firstChildParams, documentDefinitionName]) =>
      this.uploadProviderService.checkUploadProcessLink(
        params?.documentDefinitionName ||
          firstChildParams?.documentDefinitionName ||
          documentDefinitionName
      )
    ),
    startWith('loading')
  );
  readonly isAdmin$: Observable<boolean> = this.userProviderService
    .getUserSubject()
    .pipe(map(userIdentity => userIdentity?.roles.includes('ROLE_ADMIN')));

  constructor(
    private readonly uploadProviderService: UploadProviderService,
    private readonly stateService: FormIoStateService,
    private readonly domService: FormIoDomService,
    private readonly downloadService: DownloadService,
    private readonly modalService: ValtimoModalService,
    private readonly userProviderService: UserProviderService,
    private readonly route: ActivatedRoute
  ) {}

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
}
