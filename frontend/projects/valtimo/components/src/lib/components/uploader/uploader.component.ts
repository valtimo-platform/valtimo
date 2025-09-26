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

import {Component, EventEmitter, Input, Output} from '@angular/core';
import {S3Resource, S3Service} from '@valtimo/resource';

@Component({
  selector: 'valtimo-uploader',
  templateUrl: './uploader.component.html',
  styleUrls: ['./uploader.component.css'],
})
export class UploaderComponent {
  public resources: any = [];
  @Output() resourcesChanged: EventEmitter<any> = new EventEmitter();
  @Output() resourceRegistered: EventEmitter<S3Resource> = new EventEmitter();
  @Input() showFileList = true;

  constructor(private s3Service: S3Service) {}

  onFileFieldChange(files) {
    for (const file of files) {
      this.uploadFile(file);
    }
  }

  uploadFile(file: File) {
    this.s3Service.getPreSignedUrl(file.name).subscribe(value => {
      const preSignedUrl: URL = new URL(value);
      this.s3Service.upload(preSignedUrl, file).subscribe(result => {
        const s3ResourceDTO = new S3Resource(file, preSignedUrl);
        this.s3Service.registerResource(s3ResourceDTO).subscribe(resource => {
          this.resources.push(resource);
          this.resourceRegistered.emit(resource);
          this.resourcesChanged.emit(this.resources);
        });
      });
    });
  }

  deleteResource(resource) {
    this.s3Service.delete(resource.id).subscribe(result => {
      const index = this.resources.findIndex(res => res.id === resource.id);
      this.resources.splice(index, 1);
      this.resourcesChanged.emit(this.resources);
    });
  }
}
