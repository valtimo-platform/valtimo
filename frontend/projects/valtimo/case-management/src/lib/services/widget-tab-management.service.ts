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
import {Injectable} from '@angular/core';
import {ConfigService, CaseManagementParams} from '@valtimo/shared';
import {CaseWidgetsRes} from '@valtimo/case';
import {BehaviorSubject, Observable, map, switchMap} from 'rxjs';
import {BasicWidget, IWidgetManagementService} from '@valtimo/layout';

@Injectable({
  providedIn: 'root',
})
export class WidgetTabManagementService
  implements IWidgetManagementService<CaseManagementParams & {widgetTabKey: string}>
{
  private readonly valtimoEndpointBase: string;

  constructor(
    private readonly http: HttpClient,
    private readonly configService: ConfigService
  ) {
    this.valtimoEndpointBase = `${this.configService.config.valtimoApi.endpointUri}management/v1/case-definition`;
  }
  valueResolverApi$: BehaviorSubject<string | null> = new BehaviorSubject<string | null>('');
  //TODO: Update when IKO widget management is done

  public readonly params$: BehaviorSubject<CaseManagementParams & {widgetTabKey: string}> =
    new BehaviorSubject<CaseManagementParams & {widgetTabKey: string}>({
      caseDefinitionKey: '',
      caseDefinitionVersionTag: '',
      widgetTabKey: '',
    });
  public initParams(params: CaseManagementParams & {widgetTabKey: string}): void {
    this.params$.next(params);
  }
  deleteWidget(widget: BasicWidget): Observable<void> {
    throw new Error('Method not implemented.');
  }
  updateWidget(widget: BasicWidget): Observable<BasicWidget> {
    throw new Error('Method not implemented.');
  }
  createWidget(widget: BasicWidget): Observable<BasicWidget> {
    throw new Error('Method not implemented.');
  }

  public getWidgetConfiguration(): Observable<BasicWidget[]> {
    return this.params$.pipe(
      switchMap((params: CaseManagementParams & {widgetTabKey: string}) =>
        this.http.get<CaseWidgetsRes>(
          `${this.valtimoEndpointBase}/${params.caseDefinitionKey}/version/${params.caseDefinitionVersionTag}/widget-tab/${params.widgetTabKey}`
        )
      ),
      map((res: CaseWidgetsRes) => res.widgets)
    );
  }

  public updateWidgetConfiguration(...params: any[]): Observable<BasicWidget[]> {
    throw new Error('Method not implemented.');
  }

  public getWidgetTabConfiguration(
    params: CaseManagementParams,
    widgetTabKey: string
  ): Observable<CaseWidgetsRes> {
    return this.http.get<CaseWidgetsRes>(
      `${this.valtimoEndpointBase}/${params.caseDefinitionKey}/version/${params.caseDefinitionVersionTag}/widget-tab/${widgetTabKey}`
    );
  }

  public updateWidgets(tab: CaseWidgetsRes): Observable<any> {
    return this.http.post<any>(
      `${this.valtimoEndpointBase}/${tab.caseDefinitionKey}/version/${tab.caseDefinitionVersionTag}/widget-tab/${tab.key}`,
      tab
    );
  }
}
