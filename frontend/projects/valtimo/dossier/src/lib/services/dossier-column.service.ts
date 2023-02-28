/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
import {ConfigService, DefinitionColumn} from '@valtimo/config';
import {map, Observable} from 'rxjs';
import {CaseListColumn, DocumentService} from '@valtimo/document';

@Injectable({
  providedIn: 'root',
})
export class DossierColumnService {
  constructor(
    private readonly configService: ConfigService,
    private readonly documentService: DocumentService
  ) {}

  getDefinitionColumns(
    documentDefinitionName: string
  ): Observable<{columns: Array<DefinitionColumn>; hasApiConfig: boolean}> {
    const config = this.configService.config;
    const customDefinitionTable = config.customDefinitionTables[documentDefinitionName];
    const defaultDefinitionTable = config.defaultDefinitionTable;

    return this.documentService.getCaseList(documentDefinitionName).pipe(
      map(caseListColumns => {
        const apiCaseListColumns =
          config?.featureToggles?.caseListColumn &&
          caseListColumns &&
          Array.isArray(caseListColumns) &&
          caseListColumns.length > 0 &&
          this.mapCaseListColumnsToDefinitionColumns(caseListColumns);

        return {
          columns: customDefinitionTable || apiCaseListColumns || defaultDefinitionTable,
          hasApiConfig: !!apiCaseListColumns,
        };
      })
    );
  }

  hasEnvironmentConfig(documentDefinitionName: string): boolean {
    return !!this.configService.config?.customDefinitionTables[documentDefinitionName];
  }

  private mapCaseListColumnsToDefinitionColumns(
    caseListColumns: Array<CaseListColumn>
  ): Array<DefinitionColumn> {
    return caseListColumns.map(caseListColumn => ({
      translationKey: caseListColumn.key,
      sortable: caseListColumn.sortable,
      default: caseListColumn.defaultSort,
      viewType: this.getViewType(caseListColumn.displayType.type),
      propertyName: this.getPropertyName(caseListColumn.path),
      ...(caseListColumn.title && {title: caseListColumn.title}),
      ...(caseListColumn?.displayType?.displayTypeParameters?.enum && {
        enum: caseListColumn.displayType.displayTypeParameters.enum as any,
      }),
      ...(caseListColumn.displayType?.displayTypeParameters?.dateFormat && {
        format: caseListColumn.displayType?.displayTypeParameters?.dateFormat,
      }),
    }));
  }

  private getViewType(caseListColumnDisplayType: string): string {
    switch (caseListColumnDisplayType) {
      case 'arrayCount':
        return 'relatedFiles';
        break;
      case 'underscoresToSpaces':
        return 'stringReplaceUnderscore';
      default:
        return caseListColumnDisplayType;
        break;
    }
  }

  private getPropertyName(caseListColumnPath: string): string {
    return caseListColumnPath.replace('doc:', '$.').replace('case:', '');
  }
}
