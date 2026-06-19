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

export interface ResourceReference {
  filename: string;
  id: string;
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
    // Extract key from URL pathname
    // Path-style URL: /bucket-name/key -> extract key after bucket
    // Virtual-hosted URL: /key -> extract key directly
    const pathParts = preSignedUrl.pathname.substring(1).split('/');
    // If path has multiple segments, first is bucket name (path-style), rest is key
    // If path has single segment, it's the key directly (virtual-hosted)
    const key = pathParts.length > 1 ? pathParts.slice(1).join('/') : pathParts[0];
    this.key = decodeURIComponent(key);
    this.name = file.name;
    this.sizeInBytes = file.size;
    if (!documentId) {
      return;
    }
    this.documentId = documentId;
  }
}
