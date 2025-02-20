import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {BaseApiService, ConfigService} from '@valtimo/config';
import {Page} from '@valtimo/document';
import {Observable} from 'rxjs';
import {CaseListItem} from '../models';

@Injectable({
  providedIn: 'root',
})
export class CaseManagementService extends BaseApiService {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getCaseDefinitions(params: any): Observable<Page<CaseListItem>> {
    return this.httpClient.get<Page<CaseListItem>>(
      `${this.getApiUrl('management/v1/case-definition')}`,
      {params}
    );
  }
}
