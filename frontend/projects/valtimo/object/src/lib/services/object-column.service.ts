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
import {map, Observable} from 'rxjs';
import {ObjectManagementService, SearchColumn, SearchListColumn} from '@valtimo/object-management';

@Injectable({
  providedIn: 'root',
})
export class ObjectColumnService {
  constructor(
    private readonly configService: ConfigService,
    private readonly objectManagementService: ObjectManagementService
  ) {}

  getObjectColumns(configurationId: string): Observable<Array<SearchColumn>> {
    return this.objectManagementService
      .getSearchList(configurationId)
      .pipe(
        map(
          objectListColumns =>
            objectListColumns &&
            Array.isArray(objectListColumns) &&
            objectListColumns.length > 0 &&
            this.mapObjectListColumnsToSearchColumns(objectListColumns)
        )
      );
  }

  private mapObjectListColumnsToSearchColumns(
    searchListColumns: Array<SearchListColumn>
  ): Array<SearchColumn> {
    return searchListColumns.map(searchListColumn => ({
      translationKey: searchListColumn.key,
      sortable: searchListColumn.sortable,
      defaultSort: searchListColumn.defaultSort,
      viewType: this.getDisplayType(searchListColumn.displayType.type),
      propertyName: searchListColumn.path,
      ...(searchListColumn.title && {title: searchListColumn.title}),
      ...(searchListColumn?.displayType?.displayTypeParameters?.enum && {
        enum: searchListColumn.displayType.displayTypeParameters.enum as any,
      }),
      ...(searchListColumn.displayType?.displayTypeParameters?.dateFormat && {
        format: searchListColumn.displayType?.displayTypeParameters?.dateFormat,
      }),
    }));
  }

  private getDisplayType(searchListColumnDisplayType: string): string {
    switch (searchListColumnDisplayType) {
      default:
        return searchListColumnDisplayType;
    }
  }
}
