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

import {Observable} from 'rxjs';
import {map, switchMap, tap} from 'rxjs/operators';
import {ResourceDto, ResourceFile, S3Resource, UploadService} from '../models';
import {Injectable} from '@angular/core';
import {v4 as uuidv4} from 'uuid';
import {S3Service} from './s3.service';

@Injectable()
export class S3UploadService implements UploadService {
  constructor(private readonly s3Service: S3Service) {}

  uploadFile(file: File, _, documentId?: string): Observable<ResourceFile> {
    let resourceUrl: URL;
    const fileName = file.name;
    const splitFileName = fileName.split('.');
    const fileNameWithUUID = `${splitFileName[0]}-${uuidv4()}.${splitFileName[1]}`;
    const renamedFile = new File([file], fileNameWithUUID, {type: file.type});

    return this.s3Service.getPreSignedUrl(renamedFile.name).pipe(
      map(url => new URL(url)),
      tap(url => (resourceUrl = url)),
      switchMap(url => this.s3Service.upload(url, renamedFile)),
      map(() => new S3Resource(file, resourceUrl, documentId)),
      switchMap(s3Resource => this.s3Service.registerResource(s3Resource)),
      switchMap(s3Resource => this.s3Service.get(s3Resource.id)),
      map(result => ({...result, originalName: file.name})),
      map(result => this.getResourceFile(result))
    );
  }

  getResource(resourceId: string): Observable<ResourceDto> {
    return this.s3Service.get(resourceId);
  }

  private getResourceFile(result: ResourceDto): ResourceFile {
    return {
      customUpload: true,
      originalName: result.originalName,
      url: result.url,
      size: result.resource.sizeInBytes,
      storage: 'url',
      type: result.resource.extension,
      data: {
        key: result.resource.key,
        bucketName: result.resource.name,
        createdOn: result.resource.createdOn as any as string,
        name: result.originalName,
        sizeInBytes: result.resource.sizeInBytes,
        resourceId: result.resource.id.split('ResourceId(id=')[1].slice(0, -1),
      },
    };
  }
}
