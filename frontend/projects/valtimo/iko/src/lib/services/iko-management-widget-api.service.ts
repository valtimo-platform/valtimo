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
import {BasicWidget, IWidgetManagementService} from '@valtimo/layout';
import {BaseApiService, ConfigService} from '@valtimo/shared';
import {isEqual} from 'lodash';
import {BehaviorSubject, filter, Observable, switchMap} from 'rxjs';
import {IkoManagementParams} from '../models';

@Injectable()
export class IkoWidgetManagementApiService
  extends BaseApiService
  implements IWidgetManagementService<IkoManagementParams>
{
  private readonly _params$ = new BehaviorSubject<IkoManagementParams | null>(null);
  private get _params(): IkoManagementParams {
    return this._params$.getValue();
  }
  public get params$(): Observable<IkoManagementParams> {
    return this._params$.pipe(filter(params => !!params));
  }

  constructor(
    protected override httpClient: HttpClient,
    protected override configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public initParams(serviceParams: IkoManagementParams): void {
    if (!isEqual(serviceParams, this._params)) this._params$.next(serviceParams);
  }

  public getWidgetConfiguration(): Observable<BasicWidget[]> {
    return this.params$.pipe(
      filter((params: IkoManagementParams | null) => !!params),
      switchMap((params: IkoManagementParams | null) =>
        this.httpClient.get<BasicWidget[]>(
          this.getApiUrl(
            `management/v1/iko-view/${params?.aggregateKey}/tab/${params?.widgetTabKey}/widget`
          )
        )
      )
    );
  }

  public updateWidgetConfiguration(widgets: BasicWidget[]): Observable<BasicWidget[]> {
    return this.params$.pipe(
      filter((params: IkoManagementParams | null) => !!params),
      switchMap((params: IkoManagementParams | null) =>
        this.httpClient.put<BasicWidget[]>(
          this.getApiUrl(
            `management/v1/iko-view/${params?.aggregateKey}/tab/${params?.widgetTabKey}/widget`
          ),
          widgets
        )
      )
    );
  }

  public deleteWidget(widget: BasicWidget): Observable<void> {
    return this.params$.pipe(
      filter((params: IkoManagementParams | null) => !!params),
      switchMap((params: IkoManagementParams | null) =>
        this.httpClient.delete<void>(
          this.getApiUrl(
            `management/v1/iko-view/${params?.aggregateKey}/tab/${params?.widgetTabKey}/widget/${widget.key}`
          )
        )
      )
    );
  }

  public updateWidget(widget: BasicWidget): Observable<BasicWidget> {
    return this.params$.pipe(
      filter((params: IkoManagementParams | null) => !!params),
      switchMap((params: IkoManagementParams | null) =>
        this.httpClient.put<BasicWidget>(
          this.getApiUrl(
            `management/v1/iko-view/${params?.aggregateKey}/tab/${params?.widgetTabKey}/widget/${widget.key}`
          ),
          widget
        )
      )
    );
  }

  public createWidget(widget: BasicWidget): Observable<BasicWidget> {
    return this.params$.pipe(
      filter((params: IkoManagementParams | null) => !!params),
      switchMap((params: IkoManagementParams | null) =>
        this.httpClient.post<BasicWidget>(
          this.getApiUrl(
            `management/v1/iko-view/${params?.aggregateKey}/tab/${params?.widgetTabKey}/widget/${widget.key}`
          ),
          widget
        )
      )
    );
  }
}
