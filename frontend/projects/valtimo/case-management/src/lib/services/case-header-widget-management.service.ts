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

import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {
  BaseApiService,
  CaseManagementParams,
  ConfigService,
  InterceptorSkip,
} from '@valtimo/shared';
import {BasicWidget, IWidgetManagementService} from '@valtimo/layout';
import {BehaviorSubject, catchError, filter, map, Observable, of, switchMap} from 'rxjs';
import {isEqual} from 'lodash';

@Injectable()
export class CaseHeaderWidgetManagementService
  extends BaseApiService
  implements IWidgetManagementService<CaseManagementParams>
{
  private readonly _params$ = new BehaviorSubject<CaseManagementParams | null>(null);
  public readonly params$: Observable<CaseManagementParams | null> = this._params$.asObservable();
  private readonly paramsRequired$ = this._params$.pipe(
    filter((p): p is CaseManagementParams => !!p)
  );

  constructor(
    protected override httpClient: HttpClient,
    protected override configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public initParams(...params: any[]): void {
    const serviceParams = params[0] as CaseManagementParams;
    if (!isEqual(serviceParams, this._params$.getValue())) {
      this._params$.next(serviceParams);
    }
  }

  public getWidgetConfiguration(): Observable<BasicWidget[]> {
    return this.paramsRequired$.pipe(
      switchMap(({caseDefinitionKey, caseDefinitionVersionTag}) =>
        this.httpClient
          .get<BasicWidget>(
            this.getApiUrl(
              `management/v1/case-definition/${encodeURIComponent(
                caseDefinitionKey
              )}/version/${encodeURIComponent(caseDefinitionVersionTag)}/header-widget`
            ),
            {
              headers: new HttpHeaders().set(InterceptorSkip, '404'),
            }
          )
          .pipe(
            map(widget => [widget].filter(Boolean)),
            catchError(err => {
              if (err?.status === 404) return of([] as BasicWidget[]);
              throw err;
            })
          )
      )
    );
  }

  public updateWidgetConfiguration(widgets: BasicWidget[]): Observable<BasicWidget[]> {
    const widget = widgets[0];
    return this.paramsRequired$.pipe(
      switchMap(({caseDefinitionKey, caseDefinitionVersionTag}) =>
        this.httpClient.put<BasicWidget>(
          this.getApiUrl(
            `management/v1/case-definition/${encodeURIComponent(
              caseDefinitionKey
            )}/version/${encodeURIComponent(caseDefinitionVersionTag)}/header-widget`
          ),
          widget
        )
      ),
      map(updated => [updated].filter(Boolean))
    );
  }

  public deleteWidget(_: BasicWidget): Observable<void> {
    return this.paramsRequired$.pipe(
      switchMap(({caseDefinitionKey, caseDefinitionVersionTag}) =>
        this.httpClient.delete<void>(
          this.getApiUrl(
            `management/v1/case-definition/${encodeURIComponent(
              caseDefinitionKey
            )}/version/${encodeURIComponent(caseDefinitionVersionTag)}/header-widget`
          )
        )
      )
    );
  }

  public updateWidget(widget: BasicWidget): Observable<BasicWidget> {
    return this.paramsRequired$.pipe(
      switchMap(({caseDefinitionKey, caseDefinitionVersionTag}) =>
        this.httpClient.put<BasicWidget>(
          this.getApiUrl(
            `management/v1/case-definition/${encodeURIComponent(
              caseDefinitionKey
            )}/version/${encodeURIComponent(caseDefinitionVersionTag)}/header-widget`
          ),
          widget
        )
      )
    );
  }

  public createWidget(widget: BasicWidget): Observable<BasicWidget> {
    return this.paramsRequired$.pipe(
      switchMap(({caseDefinitionKey, caseDefinitionVersionTag}) =>
        this.httpClient.post<BasicWidget>(
          this.getApiUrl(
            `management/v1/case-definition/${encodeURIComponent(
              caseDefinitionKey
            )}/version/${encodeURIComponent(caseDefinitionVersionTag)}/header-widget`
          ),
          widget
        )
      )
    );
  }
}
