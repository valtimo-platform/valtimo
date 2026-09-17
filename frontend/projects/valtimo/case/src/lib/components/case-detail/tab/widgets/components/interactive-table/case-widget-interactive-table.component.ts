/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
import {HttpParams} from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {CarbonListItem, CarbonListModule} from '@valtimo/components';
import {CaseDefinition} from '@valtimo/document';
import {
  InteractiveTableWidget,
  WidgetAction,
  WidgetActionData,
  WidgetActionService,
  WidgetInteractiveTableComponent,
  WidgetLayoutService,
} from '@valtimo/layout';
import {Page} from '@valtimo/shared';
import {ButtonModule, ModalModule} from 'carbon-components-angular';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  filter,
  Observable,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import {CaseListActionsComponent} from '../../../../../case-list-actions/case-list-actions.component';
import {CaseListService, CaseTabService, CaseWidgetsApiService} from '../../../../../../services';
import {WidgetsService} from '../../widgets.service';

@Component({
  selector: 'valtimo-case-widget-interactive-table',
  templateUrl: './case-widget-interactive-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    CarbonListModule,
    CaseListActionsComponent,
    ModalModule,
    TranslateModule,
    WidgetInteractiveTableComponent,
  ],
  providers: [CaseListService],
})
export class CaseWidgetInteractiveTableComponent {
  @ViewChild(CaseListActionsComponent) public listActionsComponent: CaseListActionsComponent;

  private readonly _documentId$ = new BehaviorSubject<string>('');
  @Input({required: true}) public set documentId(value: string) {
    this._documentId$.next(value);
  }

  public readonly widgetConfiguration$ = new BehaviorSubject<InteractiveTableWidget | null>(null);
  @Input({required: true}) public set widgetConfiguration(value: InteractiveTableWidget) {
    this.widgetConfiguration$.next(value);
  }

  @Input() public readonly widgetUuid: string;

  private readonly _queryParams$ = new BehaviorSubject<HttpParams>(new HttpParams());

  private readonly _tabKey$: Observable<string> = this.caseTabService.activeTabKey$;

  private readonly _refresh$ = this.widgetsService.refreshWidgets$.pipe(startWith(null));

  public readonly widgetData$: Observable<Page<CarbonListItem> | null> = combineLatest([
    this.widgetConfiguration$.pipe(filter(widget => !!widget)),
    this._documentId$.pipe(filter(documentId => !!documentId)),
    this._tabKey$,
    this._queryParams$.pipe(
      distinctUntilChanged(
        (previousParams, currentParams) => previousParams.toString() === currentParams.toString()
      )
    ),
    this._refresh$,
  ]).pipe(
    switchMap(([widget, documentId, tabKey, queryParams]) =>
      this.caseWidgetsApiService
        .getWidgetData(documentId, tabKey, widget.key, queryParams.toString())
        .pipe(catchError(() => of(null)))
    ),
    tap(() => this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid))
  );

  constructor(
    private readonly caseListService: CaseListService,
    private readonly caseTabService: CaseTabService,
    private readonly caseWidgetsApiService: CaseWidgetsApiService,
    private readonly widgetActionService: WidgetActionService,
    private readonly widgetLayoutService: WidgetLayoutService,
    private readonly widgetsService: WidgetsService
  ) {}

  public onActionEvent(action: WidgetAction, widgetData: WidgetActionData | null): void {
    this.widgetActionService.handleAction(action, widgetData);
  }

  public onCaseStartEvent(caseDefinition: CaseDefinition): void {
    this.caseListService.setCaseDefinitionKey(caseDefinition.caseDefinitionKey);
    this.listActionsComponent.startCase();
  }

  public onQueryParamsEvent(params: HttpParams, widget: InteractiveTableWidget | null): void {
    this._queryParams$.next(this.withDefaultPageSize(params, widget));
  }

  public onRowClickEvent(row: WidgetActionData, widget: InteractiveTableWidget | null): void {
    this.widgetActionService.handleAction(widget?.properties?.rowClickAction, row);
  }

  private withDefaultPageSize(
    params: HttpParams,
    widget: InteractiveTableWidget | null
  ): HttpParams {
    const defaultPageSize = widget?.properties?.defaultPageSize;

    return params.has('size') || !defaultPageSize
      ? params
      : params.set('size', `${defaultPageSize}`);
  }
}
