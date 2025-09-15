import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {BaseApiService, ConfigService} from '@valtimo/shared';
import {Observable} from 'rxjs';
import {CaseListHiddenColumn} from '../models';
import {ListField} from '@valtimo/components';

@Injectable({
  providedIn: 'root',
})
export class CaseListHiddenColumnsService extends BaseApiService {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getHiddenColumns(caseDefinitionKey: string): Observable<ListField[]> {
    return this.httpClient.get<ListField[]>(
      this.getApiUrl(`v1/case/${caseDefinitionKey}/hidden-list-column`)
    );
  }

  public saveHiddenColumns(
    caseDefinitionKey: string,
    hiddenColumns: CaseListHiddenColumn[]
  ): Observable<CaseListHiddenColumn[]> {
    return this.httpClient.post<CaseListHiddenColumn[]>(
      this.getApiUrl(`v1/case/${caseDefinitionKey}/hidden-list-column`),
      hiddenColumns
    );
  }
}
