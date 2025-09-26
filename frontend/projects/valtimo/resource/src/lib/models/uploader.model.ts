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

export interface ResourceDto {
  url: string;
  resource: Resource;
  originalName?: string;
}

export interface Resource {
  id?: string;
  key: string;
  name: string;
  sizeInBytes: number;
  extension?: string;
  createdOn?: Date;
}

export interface OpenZaakResource {
  resourceId: string;
  informatieObjectUrl: string;
  createdOn: string;
  name: string;
  extension: string;
  sizeInBytes: number;
}

export class S3Resource implements Resource {
  id?: string = null;
  key: string;
  name: string;
  sizeInBytes: number;
  extension?: string = null;
  createdOn?: Date = null;
  documentId?: string;

  constructor(file: File, preSignedUrl: URL, documentId?: string) {
    this.key = decodeURIComponent(preSignedUrl.pathname.substring(1));
    this.name = file.name;
    this.sizeInBytes = file.size;
    if (!documentId) {
      return;
    }
    this.documentId = documentId;
  }
}
