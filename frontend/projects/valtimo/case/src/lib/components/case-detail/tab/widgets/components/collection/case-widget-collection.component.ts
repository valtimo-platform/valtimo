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

import {ChangeDetectionStrategy, Component, Input, ViewEncapsulation} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  ButtonModule,
  InputModule,
  PaginationModel,
  PaginationModule,
  TilesModule,
} from 'carbon-components-angular';
import {CaseWidgetAction, WidgetCollectionContent} from '../../../../../../models';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  filter,
  map,
  Observable,
  of,
  switchMap,
  tap,
} from 'rxjs';
import {CarbonListModule} from '@valtimo/components';
import {TranslateModule} from '@ngx-translate/core';
import {Page} from '@valtimo/shared';
import {CaseTabService, CaseWidgetsApiService} from '../../../../../../services';
import {WidgetProcess} from '../widget-process/widget-process';
import {DocumentService} from '@valtimo/document';
import {PermissionService} from '@valtimo/access-control';
import {WidgetsService} from '../../widgets.service';
import {
  CollectionWidget,
  CollectionWidgetCardData,
  WidgetCollectionComponent,
  WidgetLayoutService,
  WidgetWithUuid,
} from '@valtimo/layout';
import {HttpErrorResponse} from '@angular/common/http';

@Component({
  selector: 'valtimo-case-widget-collection',
  templateUrl: './case-widget-collection.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    InputModule,
    PaginationModule,
    TilesModule,
    CarbonListModule,
    TranslateModule,
    ButtonModule,
    WidgetCollectionComponent,
  ],
})
export class CaseWidgetCollectionComponent extends WidgetProcess {
  private readonly _documentId$ = new BehaviorSubject<string>('');

  @Input({required: true}) public set documentId(value: string) {
    this.baseDocumentId = value;
    this._documentId$.next(value);
  }

  @Input() public set widgetConfiguration(value: CollectionWidget) {
    if (!value) return;
    this.baseWidgetConfiguration = value;
    this.widgetConfiguration$.next(value);
  }

  @Input() public readonly widgetUuid: string;

  public readonly widgetConfiguration$ = new BehaviorSubject<CollectionWidget | null>(null);

  private readonly _queryParams$ = new BehaviorSubject<string | null>(null);

  public readonly tabKey$: Observable<string> = this.caseTabService.activeTabKey$;

  private readonly _initialWidgetData$ = combineLatest([
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

  public readonly widgetData$ = combineLatest([
    this._initialWidgetData$,
    this._queryParams$,
    this.widgetConfiguration$,
    this.tabKey$,
  ]).pipe(
    switchMap(([initialData, queryParams, widgetConfiguration, tabKey]) =>
      !queryParams
        ? of(initialData)
        : this.widgetApiService
            .getWidgetData(this.baseDocumentId, tabKey, widgetConfiguration.key, queryParams)
            .pipe(map((res: Page<CollectionWidgetCardData>) => res))
    ),
    filter(page => !!page)
  );

  constructor(
    protected readonly documentService: DocumentService,
    protected readonly permissionService: PermissionService,
    private readonly widgetApiService: CaseWidgetsApiService,
    private readonly widgetsService: WidgetsService,
    private readonly widgetLayoutService: WidgetLayoutService,
    private readonly caseTabService: CaseTabService,
    private readonly caseWidgetsApiService: CaseWidgetsApiService
  ) {
    super(documentService, permissionService);
  }

  public onPaginationEvent(event: PaginationModel): void {
    this._queryParams$.next(`page=${event.currentPage - 1}&size=${event.pageLength}`);
  }

  public onProcessStartClick(process: CaseWidgetAction): void {
    this.widgetsService.startProcess(process.processDefinitionKey);
  }

  private getPageSizeParam(widgetConfiguration: WidgetWithUuid): string {
    return `size=${(widgetConfiguration.properties as any as WidgetCollectionContent).defaultPageSize}`;
  }
}
