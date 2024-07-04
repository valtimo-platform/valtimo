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

import {Injectable} from '@angular/core';
import {ConfigService} from '@valtimo/config';
import {RelatedFile} from '@valtimo/document';

@Injectable({
  providedIn: 'root',
})
export class FileSortService {
  constructor(private readonly configService: ConfigService) {}

  sortRelatedFilesByDateDescending(relatedFiles: Array<RelatedFile>): Array<RelatedFile> {
    const sortByDate = this.configService.config?.featureToggles?.sortFilesByDate;

    if (sortByDate) {
      return relatedFiles.sort(
        (a, b) => new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime()
      );
    }

    return relatedFiles;
  }
}
