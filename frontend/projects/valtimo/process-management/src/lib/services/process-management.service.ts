import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {BaseApiService, ConfigService} from '@valtimo/config';
import {Observable, tap} from 'rxjs';
import { CaseProcessInstance } from '../models';

@Injectable({
  providedIn: 'root',
})
export class ProcessManagementService extends BaseApiService {
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

  public getProcesses(): Observable<CaseProcessInstance[]> {
    return this.httpClient.get<CaseProcessInstance[]>(
      this.getApiUrl(
        `/management/v1/case-definition/${this._documentDefinitionKey}/version/${this._versionTag}/process-definition`
      )
    );
  }

  public deleteProcess(processDefinitionId: string): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(
        `/management/v1/case-definition/${this._documentDefinitionKey}/version/${this._versionTag}/process-definition/${processDefinitionId}`
      )
    );
  }

  public deployBpmn(bpmn: File): Observable<any> {
    const formData: FormData = new FormData();
    formData.append('file', bpmn);
    formData.append(
      'processLinks',
      new Blob([JSON.stringify([].map(processLink => this.emptyStringToNull(processLink)))], {
        type: 'application/json',
      })
    );

    return this.httpClient.post<any>(
      this.getApiUrl(
        `/management/v1/case-definition/${this._documentDefinitionKey}/version/${this._versionTag}/process-definition`
      ),
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
