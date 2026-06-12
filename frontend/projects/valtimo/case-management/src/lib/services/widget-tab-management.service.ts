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
import {CaseManagementParams, ConfigService} from '@valtimo/shared';
import {BehaviorSubject, map, Observable, switchMap} from 'rxjs';
import {BasicWidget, IWidgetManagementService} from '@valtimo/layout';
import {WidgetLayout} from '@valtimo/components';
import {CaseWidgetsRes} from '@valtimo/case';

@Injectable({
  providedIn: 'root',
})
export class CaseWidgetManagementApiService
  implements IWidgetManagementService<CaseManagementParams & {key: string}>
{
  private readonly valtimoEndpointBase: string;
  private _widgetConfigurationCache: BasicWidget[] = [];
  private _widgetLayout: WidgetLayout = WidgetLayout.MUURI_GAP_FREE;

  public readonly widgetLayout$ = new BehaviorSubject<WidgetLayout>(WidgetLayout.MUURI_GAP_FREE);

  constructor(
    private readonly http: HttpClient,
    private readonly configService: ConfigService
  ) {
    this.valtimoEndpointBase = `${this.configService.config.valtimoApi.endpointUri}management/v1/case-definition`;
  }

  public readonly params$: BehaviorSubject<CaseManagementParams & {key: string}> =
    new BehaviorSubject<CaseManagementParams & {key: string}>({
      caseDefinitionKey: '',
      caseDefinitionVersionTag: '',
      key: '',
    });

  public initParams(params: CaseManagementParams & {key: string}): void {
    this.params$.next(params);
  }
  public deleteWidget(widget: BasicWidget): Observable<void> {
    return this.updateWidgets(
      this._widgetConfigurationCache.filter(
        (cachedWidget: BasicWidget) => cachedWidget.key !== widget.key
      )
    );
  }
  public updateWidget(widget: BasicWidget): Observable<BasicWidget> {
    return this.updateWidgets(
      this._widgetConfigurationCache.map((cachedWidget: BasicWidget) =>
        cachedWidget.key === widget.key ? widget : cachedWidget
      )
    );
  }
  public createWidget(widget: BasicWidget): Observable<BasicWidget> {
    return this.updateWidgets([...this._widgetConfigurationCache, widget]);
  }

  public getWidgetConfiguration(): Observable<BasicWidget[]> {
    return this.params$.pipe(
      switchMap((params: CaseManagementParams & {key: string}) =>
        this.http.get<any>(
          `${this.valtimoEndpointBase}/${params.caseDefinitionKey}/version/${params.caseDefinitionVersionTag}/widget-tab/${params.key}`
        )
      ),
      map((res: CaseWidgetsRes) => {
        this._widgetConfigurationCache = res.widgets;
        this._widgetLayout = res.widgetLayout ?? WidgetLayout.MUURI_GAP_FREE;
        this.widgetLayout$.next(this._widgetLayout);
        return res.widgets;
      })
    );
  }

  public updateWidgetConfiguration(widgets: BasicWidget[]): Observable<BasicWidget[]> {
    return this.updateWidgets(widgets);
  }

  public updateWidgetLayout(widgetLayout: WidgetLayout): Observable<unknown> {
    this._widgetLayout = widgetLayout;
    this.widgetLayout$.next(widgetLayout);
    return this.updateWidgets(this._widgetConfigurationCache);
  }

  private updateWidgets(widgets: BasicWidget[]): Observable<any> {
    return this.params$.pipe(
      switchMap((params: CaseManagementParams & {key: string}) =>
        this.http.post<any>(
          `${this.valtimoEndpointBase}/${params.caseDefinitionKey}/version/${params.caseDefinitionVersionTag}/widget-tab/${params.key}`,
          {...params, widgets, widgetLayout: this._widgetLayout}
        )
      )
    );
  }
}
