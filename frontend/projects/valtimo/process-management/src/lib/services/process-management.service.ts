import {HttpClient} from '@angular/common/http';
import {Injectable, Signal, signal} from '@angular/core';
import {BaseApiService, ConfigService} from '@valtimo/config';
import {BehaviorSubject, combineLatest, filter, Observable, switchMap} from 'rxjs';

import {
  CaseProcessInstance,
  PROCESS_MANAGEMENT_ENDPOINTS,
  ProcessManagementContext,
} from '../models';

@Injectable({
  providedIn: 'root',
})
export class ProcessManagementService extends BaseApiService {
  private readonly _definitionName$ = new BehaviorSubject<string | null>(null);
  private readonly _versionTag$ = new BehaviorSubject<string | null>(null);

  public processes$: Observable<CaseProcessInstance[]> = combineLatest([
    this._definitionName$,
    this._versionTag$,
  ]).pipe(
    filter(([definitionName, versionTag]) => !!definitionName && !!versionTag),
    switchMap(([definitionName, versionTag]) =>
      this.getProcesses(definitionName ?? '', versionTag ?? '')
    )
  );

  private _context = signal<ProcessManagementContext>('independent');
  public set context(value: ProcessManagementContext) {
    this._context.set(value);
  }
  public get context(): Signal<ProcessManagementContext> {
    return this._context.asReadonly();
  }

  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public setParams(definitionName: string, versionTag: string): void {
    this._definitionName$.next(definitionName);
    this._versionTag$.next(versionTag);
  }

  public deleteProcess(processDefinitionId: string): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(
        `${PROCESS_MANAGEMENT_ENDPOINTS[this._context()]}/${this._definitionName$.getValue()}/version/${this._versionTag$.getValue()}/process-definition/${processDefinitionId}`
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
        `${PROCESS_MANAGEMENT_ENDPOINTS[this._context()]}/${this._definitionName$.getValue()}/version/${this._versionTag$.getValue()}/process-definition`
      ),
      formData
    );
  }

  private getProcesses(
    definitionName: string,
    versionTag: string
  ): Observable<CaseProcessInstance[]> {
    return this.httpClient.get<CaseProcessInstance[]>(
      this.getApiUrl(
        `${PROCESS_MANAGEMENT_ENDPOINTS[this._context()]}/${definitionName}/version/${versionTag}/process-definition`
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
