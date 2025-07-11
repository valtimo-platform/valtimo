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
import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, Input, ViewEncapsulation} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {CarbonListItem, CarbonListModule} from '@valtimo/components';
import {Page} from '@valtimo/shared';
import {
  ButtonModule,
  PaginationModel,
  PaginationModule,
  TilesModule,
} from 'carbon-components-angular';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  filter,
  Observable,
  of,
  switchMap,
  tap,
} from 'rxjs';
import {CaseTabService, CaseWidgetsApiService} from '../../../../../../services';
import {WidgetProcess} from '../widget-process/widget-process';
import {DocumentService} from '@valtimo/document';
import {PermissionService} from '@valtimo/access-control';
import {WidgetsService} from '../../widgets.service';
import {
  TableWidget,
  WidgetAction,
  WidgetLayoutService,
  WidgetTableComponent,
  WidgetTableContent,
  WidgetWithUuid,
} from '@valtimo/layout';
import {HttpErrorResponse} from '@angular/common/http';

@Component({
  selector: 'valtimo-case-widget-table',
  templateUrl: './case-widget-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    CarbonListModule,
    PaginationModule,
    TilesModule,
    TranslateModule,
    ButtonModule,
    WidgetTableComponent,
  ],
})
export class CaseWidgetTableComponent extends WidgetProcess {
  private readonly _documentId$ = new BehaviorSubject<string>('');

  @Input({required: true}) public set documentId(value: string) {
    this.baseDocumentId = value;
    this._documentId$.next(value);
  }

  private _widgetConfiguration: TableWidget;
  public readonly widgetConfiguration$ = new BehaviorSubject<TableWidget | null>(null);
  @Input({required: true}) public set widgetConfiguration(value: TableWidget) {
    this._widgetConfiguration = value;
    this.baseWidgetConfiguration = value;
    this.widgetConfiguration$.next(value);
  }
  public get widgetConfiguration(): TableWidget {
    return this._widgetConfiguration;
  }

  @Input() public readonly widgetUuid: string;

  private readonly _queryParams$ = new BehaviorSubject<string | null>(null);

  public readonly tabKey$: Observable<string> = this.caseTabService.activeTabKey$;

  private readonly _initialWidgetData$: Observable<any[] | {} | null> = combineLatest([
    this.widgetConfiguration$,
    this.tabKey$,
    this._documentId$,
  ]).pipe(
    switchMap(([widget, tabkey, documentId]) =>
      this.caseWidgetsApiService.getWidgetData(
        documentId,
        tabkey,
        widget.key,
        this.getPageSizeParam(widget as WidgetWithUuid)
      )
    ),
    tap(() => {
      this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid);
    }),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 404) this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid);

      return of(null);
    })
  );

  public readonly widgetData$: Observable<Page<CarbonListItem>> = combineLatest([
    this._initialWidgetData$,
    this._queryParams$,
    this.tabKey$,
  ]).pipe(
    switchMap(([initialData, queryParams, tabKey]) =>
      !queryParams
        ? of(initialData as Page<CarbonListItem>)
        : this.caseWidgetsApiService.getWidgetData(
            this.baseDocumentId,
            tabKey,
            this.widgetConfiguration.key,
            queryParams
          )
    ),
    filter(page => !!page)
  );

  constructor(
    protected readonly documentService: DocumentService,
    protected readonly permissionService: PermissionService,
    private readonly caseWidgetsApiService: CaseWidgetsApiService,
    private readonly widgetsService: WidgetsService,
    private readonly caseTabService: CaseTabService,
    private readonly widgetLayoutService: WidgetLayoutService
  ) {
    super(documentService, permissionService);
  }

  public onPaginationEvent(event: PaginationModel): void {
    this._queryParams$.next(`page=${event.currentPage - 1}&size=${event.pageLength}`);
  }

  public onProcessStartClick(process: WidgetAction): void {
    this.widgetsService.startProcess(process.processDefinitionKey);
  }

  private getPageSizeParam(widgetConfiguration: WidgetWithUuid): string {
    return `size=${(widgetConfiguration.properties as WidgetTableContent).defaultPageSize}`;
  }
}
