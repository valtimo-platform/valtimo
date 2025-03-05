import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {BaseApiService, ConfigService} from '@valtimo/config';
import {Observable, tap} from 'rxjs';

@Injectable()
export class ProcessManagementApiService extends BaseApiService {
  private _documentDefinitionKey: string;
  private _versionTag: string;

  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public setParams(documentDefinitionKey: string, versionTag: string): void {
    this._documentDefinitionKey = documentDefinitionKey;
    this._versionTag = versionTag;
  }

  public getProcesses(): Observable<any> {
    return this.httpClient
      .get<any>(
        this.getApiUrl(
          `/management/v1/case-definition/${this._documentDefinitionKey}/version/${this._versionTag}/process-definition`
        )
      )
      .pipe(tap(res => console.log({res})));
  }

  public deleteProcess(processDefinitionId: string): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(
        `/management/v1/case-definition/${this._documentDefinitionKey}/version/${this._versionTag}/process-definition/${processDefinitionId}`
      )
    );
  }
}
