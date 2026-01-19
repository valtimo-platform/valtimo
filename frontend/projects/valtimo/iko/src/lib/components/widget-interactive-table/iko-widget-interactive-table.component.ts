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
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {CaseListActionsComponent, CaseListService} from '@valtimo/case';
import {CarbonListModule} from '@valtimo/components';
import {CaseDefinition} from '@valtimo/document';
import {
  InteractiveTableWidget,
  WidgetAction,
  WidgetFormioComponent,
  WidgetInteractiveTableComponent,
  WidgetLayoutService,
} from '@valtimo/layout';
import {
  ButtonModule,
  ModalModule,
  PaginationModel,
  PaginationModule,
  TilesModule,
} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, of, switchMap, tap} from 'rxjs';
import {IkoWidgetParams} from '../../models';
import {IkoApiService} from '../../services';
import { COMPONENTS_TEST_IDS, CASE_TEST_IDS } from '@valtimo/shared';

@Component({
  selector: 'valtimo-iko-widget-interactive-table',
  templateUrl: './iko-widget-interactive-table.component.html',
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
    WidgetInteractiveTableComponent,
    CaseListActionsComponent,
    ModalModule,
    WidgetFormioComponent,
  ],
  providers: [CaseListService],
})
export class IkoWidgetInteractiveTableComponent {
  readonly TEST_IDS = {
    COMPONENTS_TEST_IDS: COMPONENTS_TEST_IDS,
    CASE_TEST_IDS: CASE_TEST_IDS
  };

  @ViewChild(CaseListActionsComponent) listActionsComponent: CaseListActionsComponent;

  private _widgetConfiguration: InteractiveTableWidget;
  public readonly widgetConfiguration$ = new BehaviorSubject<InteractiveTableWidget | null>(null);
  @Input({required: true}) public set widgetConfiguration(value: InteractiveTableWidget) {
    this._widgetConfiguration = value;
    this.widgetConfiguration$.next(value);
  }
  public get widgetConfiguration(): InteractiveTableWidget {
    return this._widgetConfiguration;
  }

  @Input() public readonly widgetUuid: string;

  private readonly _widgetParams$ = new BehaviorSubject<IkoWidgetParams | null>(null);
  @Input() public set widgetParams(value: IkoWidgetParams) {
    this._widgetParams$.next(value);
  }

  private readonly _queryParams$ = new BehaviorSubject<string | null>(null);

  public readonly widgetData$ = combineLatest([
    this.widgetConfiguration$,
    this._widgetParams$,
    this.listService.forceRefresh$,
  ]).pipe(
    switchMap(([widgetConfiguration, widgetParams]) =>
      !widgetParams || !widgetConfiguration
        ? of(null)
        : this.ikoApiService.getIkoWidgetData(
            widgetParams.ikoViewKey,
            widgetParams.tabKey,
            widgetConfiguration.key,
            widgetParams.entryId
          )
    ),
    tap(() => this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid))
  );

  constructor(
    private readonly ikoApiService: IkoApiService,
    private readonly widgetLayoutService: WidgetLayoutService,
    private readonly listService: CaseListService
  ) {}

  public onPaginationEvent(event: PaginationModel): void {
    this._queryParams$.next(`page=${event.currentPage - 1}&size=${event.pageLength}`);
  }

  public onRowClickEvent(event: any, widgetConfiguration: InteractiveTableWidget): void {
    this.ikoApiService.handleAction(widgetConfiguration.properties.rowClickAction, event.resolved);
  }

  public onActionEvent(action: WidgetAction, resolvedData: {[key: string]: any}): void {
    this.ikoApiService.handleAction(action, resolvedData);
  }

  public onCaseStartEvent(caseDefintion: CaseDefinition): void {
    this.listService.setCaseDefinitionKey(caseDefintion.caseDefinitionKey);
    this.listActionsComponent.startCase();
  }
}
