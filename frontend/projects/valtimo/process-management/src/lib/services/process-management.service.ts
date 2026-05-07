/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import {HttpClient} from '@angular/common/http';
import {Injectable, Signal, signal} from '@angular/core';
import {
  BaseApiService,
  BuildingBlockProcessDefinitionWithLinksDto,
  ConfigService,
  ManagementContext,
} from '@valtimo/shared';
import {BehaviorSubject, combineLatest, Observable, of, switchMap} from 'rxjs';
import {toObservable} from '@angular/core/rxjs-interop';

import {
  PROCESS_MANAGEMENT_ENDPOINTS,
  ProcessDefinitionResult,
  UpdateProcessDefinitionCaseDefinitionRequest,
} from '../models';

@Injectable({
  providedIn: 'root',
})
export class ProcessManagementService extends BaseApiService {
  private readonly _definitionKey$ = new BehaviorSubject<string | null>(null);
  private readonly _versionTag$ = new BehaviorSubject<string | null>(null);

  public get caseDefinitionKey(): string {
    return this._definitionKey$.getValue() ?? '';
  }

  public get caseDefinitionVersionTag(): string {
    return this._versionTag$.getValue() ?? '';
  }

  private _$context = signal<ManagementContext>('independent');
  public set context(value: ManagementContext) {
    this._$context.set(value);
  }
  public get $context(): Signal<ManagementContext> {
    return this._$context.asReadonly();
  }

  public processes$: Observable<ProcessDefinitionResult[]> = combineLatest([
    this._definitionKey$,
    this._versionTag$,
    toObservable(this._$context),
  ]).pipe(
    switchMap(([definitionKey, versionTag, context]) => {
      if (context === 'independent') {
        return this.getUnlinkedProcesses();
      }
      if (!!definitionKey && !!versionTag) {
        return this.getProcesses(definitionKey, versionTag);
      }
      return of([]);
    })
  );

  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public setParams(key: string, versionTag: string): void {
    this._definitionKey$.next(key);
    this._versionTag$.next(versionTag);
  }

  public deleteProcess(processDefinitionKey: string): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(
        `${PROCESS_MANAGEMENT_ENDPOINTS[this._$context()]}/${this._definitionKey$.getValue()}/version/${this._versionTag$.getValue()}/process-definition/key/${processDefinitionKey}`
      )
    );
  }

  public deleteUnlinkedProcess(processDefinitionKey: string): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(
        `${PROCESS_MANAGEMENT_ENDPOINTS[this._$context()]}/key/${processDefinitionKey}`
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
      this._$context() === 'case'
        ? this.getApiUrl(
            `${PROCESS_MANAGEMENT_ENDPOINTS[this._$context()]}/${this._definitionKey$.getValue()}/version/${this._versionTag$.getValue()}/process-definition`
          )
        : this.getApiUrl(`${PROCESS_MANAGEMENT_ENDPOINTS[this._$context()]}`),
      formData
    );
  }

  public getProcessDefinitionForCase(
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string,
    processDefinitionKey: string
  ): Observable<ProcessDefinitionResult> {
    return this.httpClient.get<ProcessDefinitionResult>(
      this.getApiUrl(
        `${PROCESS_MANAGEMENT_ENDPOINTS[this._$context()]}/${caseDefinitionKey}/version/${caseDefinitionVersionTag}/process-definition/key/${processDefinitionKey}`
      )
    );
  }

  public getBuildingBlockProcessDefinition(
    key: string,
    versionTag: string,
    processDefinitionId: string
  ): Observable<BuildingBlockProcessDefinitionWithLinksDto> {
    return this.httpClient.get<BuildingBlockProcessDefinitionWithLinksDto>(
      this.getApiUrl(
        `management/v1/building-block/${key}/version/${versionTag}/process-definition/${processDefinitionId}`
      )
    );
  }

  public getUnlinkedProcessDefinitionsByKey(
    processDefinitionKey: string
  ): Observable<ProcessDefinitionResult[]> {
    return this.httpClient.get<ProcessDefinitionResult[]>(
      this.getApiUrl(
        `${PROCESS_MANAGEMENT_ENDPOINTS[this._$context()]}/key/${processDefinitionKey}`
      )
    );
  }

  public updateProcessDefinitionCaseDefinitionProperties(
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string,
    processDefinitionId: string,
    body: UpdateProcessDefinitionCaseDefinitionRequest
  ): Observable<void> {
    return this.httpClient.put<void>(
      this.getApiUrl(
        `/management/v1/case-definition/${caseDefinitionKey}/version/${caseDefinitionVersionTag}/process/${processDefinitionId}/properties`
      ),
      body
    );
  }

  private getProcesses(
    definitionName: string,
    versionTag: string
  ): Observable<ProcessDefinitionResult[]> {
    return this.httpClient.get<ProcessDefinitionResult[]>(
      this.getApiUrl(
        `${PROCESS_MANAGEMENT_ENDPOINTS[this._$context()]}/${definitionName}/version/${versionTag}/process-definition`
      )
    );
  }

  private getUnlinkedProcesses(): Observable<ProcessDefinitionResult[]> {
    return this.httpClient.get<ProcessDefinitionResult[]>(
      this.getApiUrl(`${PROCESS_MANAGEMENT_ENDPOINTS[this._$context()]}`)
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
