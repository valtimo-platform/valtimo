import {Injectable} from '@angular/core';
import {ConfigService} from '@valtimo/config';
import {map, Observable} from 'rxjs';
import {ObjectManagementService, SearchListColumn, SearchColumn} from '@valtimo/object-management';

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
