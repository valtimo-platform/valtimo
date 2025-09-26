import {HttpClient} from '@angular/common/http';
import {Injectable, Signal, signal} from '@angular/core';
import {BaseApiService, ConfigService, ManagementContext} from '@valtimo/config';
import {BehaviorSubject, combineLatest, filter, Observable, switchMap} from 'rxjs';

import {CaseProcessInstance, PROCESS_MANAGEMENT_ENDPOINTS} from '../models';

@Injectable({
  providedIn: 'root',
})
export class ProcessManagementService extends BaseApiService {
  private readonly _definitionKey$ = new BehaviorSubject<string | null>(null);
  private readonly _caseDefinitionVersionTag$ = new BehaviorSubject<string | null>(null);

  public processes$: Observable<CaseProcessInstance[]> = combineLatest([
    this._definitionKey$,
    this._caseDefinitionVersionTag$,
  ]).pipe(
    filter(
      ([definitionKey, caseDefinitionVersionTag]) => !!definitionKey && !!caseDefinitionVersionTag
    ),
    switchMap(([definitionKey, caseDefinitionVersionTag]) =>
      this.getProcesses(definitionKey ?? '', caseDefinitionVersionTag ?? '')
    )
  );

  private _context = signal<ManagementContext>('independent');
  public set context(value: ManagementContext) {
    this._context.set(value);
  }
  public get context(): Signal<ManagementContext> {
    return this._context.asReadonly();
  }

  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public setParams(caseDefinitionKey: string, caseDefinitionVersionTag: string): void {
    this._definitionKey$.next(caseDefinitionKey);
    this._caseDefinitionVersionTag$.next(caseDefinitionVersionTag);
  }

  public deleteProcess(processDefinitionId: string): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(
        `${PROCESS_MANAGEMENT_ENDPOINTS[this._context()]}/${this._definitionKey$.getValue()}/version/${this._caseDefinitionVersionTag$.getValue()}/process-definition/${processDefinitionId}`
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
        `${PROCESS_MANAGEMENT_ENDPOINTS[this._context()]}/${this._definitionKey$.getValue()}/version/${this._caseDefinitionVersionTag$.getValue()}/process-definition`
      ),
      formData
    );
  }

  private getProcesses(
    definitionName: string,
    caseDefinitionVersionTag: string
  ): Observable<CaseProcessInstance[]> {
    return this.httpClient.get<CaseProcessInstance[]>(
      this.getApiUrl(
        `${PROCESS_MANAGEMENT_ENDPOINTS[this._context()]}/${definitionName}/version/${caseDefinitionVersionTag}/process-definition`
      )
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
