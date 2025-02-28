import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {BaseApiService, ConfigService} from '@valtimo/config';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ProcessManagementApiService extends BaseApiService {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getProcesses(documentDefinitionKey: string, versionTag: string): Observable<any> {
    console.log(
      this.getApiUrl(
        `/management/v1/case-definition/${documentDefinitionKey}/version/${versionTag}/process-definition`
      )
    );

    return this.httpClient.get<any>(
      this.getApiUrl(
        `/management/v1/case-definition/${documentDefinitionKey}/version/${versionTag}/process-definition`
      )
      // 'http://localhost:4200/api/management/v1/case-definition/bezwaar/version/1.0.0-test/process-definition'
    );
    // return this.httpClient.get(
    //   `${this.getApiUrl('/management/v1/case-definition/')}${documentDefinitionKey}/version/${version}/process-definition`
    // );
  }
}
