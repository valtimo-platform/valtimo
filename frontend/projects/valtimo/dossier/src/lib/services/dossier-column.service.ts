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

  getDefinitionColumns(documentDefinitionName: string): Observable<Array<DefinitionColumn>> {
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

        return customDefinitionTable || apiCaseListColumns || defaultDefinitionTable;
      })
    );
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
