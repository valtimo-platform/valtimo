import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {DatePickerComponent} from '@valtimo/components';
import {BaseApiService, ConfigService} from '@valtimo/config';
import {ProcessLinkCreateEvent} from '@valtimo/process-link';
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

  public deployProcessWithProcessLinks(
    processLinks: ProcessLinkCreateEvent[] = [],
    processDefinitionId: string | null,
    processXml: string | null
  ) {
    const formData = new FormData();
    const processLinksBlob = new Blob(
      [JSON.stringify(processLinks.map(processLink => this.emptyStringToNull(processLink)))],
      {type: 'application/json'}
    );

    if (processXml) formData.append('file', new File([processXml], 'process.bpmn'));
    if (processDefinitionId) formData.append('processDefinitionId', processDefinitionId);
    formData.append('processLinks', processLinksBlob);
    formData.append('deployment-name', 'valtimoConsoleApp');
    formData.append('deployment-source', 'process application');

    return this.httpClient.post(
      this.getApiUrl(`v1/process/definition/deployment/process-link`),
      formData
    );
  }

  private emptyStringToNull<T extends Record<string, any>>(object: T): T {
    if (object && typeof object === 'object') {
      Object.keys(object).forEach(key => {
        const typedKey = key as keyof T;
        const value = object[typedKey];
        if (typeof value === 'object' && value !== null) {
          this.emptyStringToNull(value);
        } else if (value === '') {
          object[typedKey] = null as any;
        }
      });
    }
    return object;
  }
}
