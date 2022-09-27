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

import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FormioCustomComponent} from '@formio/angular';
import {BehaviorSubject, Subject} from 'rxjs';
import {DownloadService, ResourceDto, ResourceFile, UploadProviderService} from '@valtimo/resource';
import {FormIoStateService} from '../services/form-io-state.service';
import {FormIoDomService} from '../services/form-io-dom.service';
import {DocumentenApiMetadata} from '../../../models';
import {take, tap} from 'rxjs/operators';

@Component({
  selector: 'valtimo-documenten-api-formio-uploader',
  templateUrl: './documenten-api-uploader.component.html',
  styleUrls: ['./documenten-api-uploader.component.scss'],
})
export class DocumentenApiUploaderComponent implements FormioCustomComponent<Array<ResourceFile>> {
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

  @Output() valueChange = new EventEmitter<Array<ResourceFile>>();

  readonly uploading$ = new BehaviorSubject<boolean>(false);
  readonly fileToBeUploaded$ = new BehaviorSubject<File | null>(null);
  readonly modalDisabled$ = new BehaviorSubject<boolean>(false);
  readonly showModal$ = new Subject<null>();
  readonly hideModal$ = new Subject<null>();

  constructor(
    private readonly uploadProviderService: UploadProviderService,
    private readonly stateService: FormIoStateService,
    private readonly domService: FormIoDomService,
    private readonly downloadService: DownloadService
  ) {}

  _value: Array<ResourceFile> = [];

  public get value(): Array<ResourceFile> {
    return this._value;
  }

  @Input()
  public set value(value: Array<ResourceFile>) {
    if (Array.isArray(value)) {
      this._value = value;
    }
  }

  downloadFile(resourceFile: ResourceFile): void {
    this.uploadProviderService
      .getResource(resourceFile.data.resourceId)
      .subscribe((resource: ResourceDto) => {
        this.downloadService.downloadFile(resource.url, resource.resource.name);
      });
  }

  fileSelected(file: File): void {
    this.fileToBeUploaded$.next(file);
    this.showModal$.next(null);
  }

  deleteFile(resourceId: string): void {
    this.domService.toggleSubmitButton(true);
    this._value = this._value.filter((file: ResourceFile) =>
      file?.data ? file?.data?.resourceId !== resourceId : true
    );
    this.valueChange.emit(this._value);
  }

  metadataSet(metadata: DocumentenApiMetadata): void {
    this.uploading$.next(true);
    this.hideModal$.next(null);

    this.fileToBeUploaded$
      .pipe(
        take(1),
        tap(file => {
          console.log('upload', file, metadata);
        })
      )
      .subscribe();
  }
}
