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

import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  filter,
  Observable,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import {CarbonListModule} from '@valtimo/components';
import {TranslateModule} from '@ngx-translate/core';
import {DocumentService} from '@valtimo/document';
import {PermissionService} from '@valtimo/access-control';
import {ButtonModule} from 'carbon-components-angular';
import {WidgetProcess} from '../widget-process/widget-process';
import {WidgetsService} from '../../widgets.service';
import {
  CustomWidget,
  WidgetAction,
  WidgetCustomComponent,
  WidgetLayoutService,
} from '@valtimo/layout';
import {HttpErrorResponse} from '@angular/common/http';
import {CaseTabService, CaseWidgetsApiService} from '../../../../../../services';
import { COMPONENTS_TEST_IDS } from '@valtimo/shared';

@Component({
  selector: 'valtimo-case-widget-custom',
  templateUrl: './case-widget-custom.component.html',
  standalone: true,
  imports: [CommonModule, CarbonListModule, TranslateModule, ButtonModule, WidgetCustomComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseWidgetCustomComponent extends WidgetProcess {
  readonly TEST_IDS = {
    COMPONENTS_TEST_IDS: COMPONENTS_TEST_IDS
  };

  private readonly _documentId$ = new BehaviorSubject<string>('');

  @Input({required: true}) public set documentId(value: string) {
    this.baseDocumentId = value;
    this._documentId$.next(value);
  }
  @Input() public set widgetConfiguration(value: CustomWidget) {
    if (!value) return;
    this.baseWidgetConfiguration = value;
    this._widgetConfigSubject$.next(value);
  }
  @Input() public readonly widgetUuid: string;

  private readonly _widgetConfigSubject$ = new BehaviorSubject<CustomWidget | null>(null);
  private readonly _tabKey$: Observable<string> = this.caseTabService.activeTabKey$;
  private readonly _refresh$ = this.widgetsService.refreshWidgets$.pipe(startWith(null));

  public get widgetConfig$(): Observable<CustomWidget> {
    return this._widgetConfigSubject$.pipe(filter(config => config !== null));
  }

  public readonly widgetData$: Observable<any[] | {} | null> = combineLatest([
    this.widgetConfig$,
    this._tabKey$,
    this._documentId$,
    this._refresh$,
  ]).pipe(
    switchMap(([widget, tabKey, documentId]) =>
      this.caseWidgetApiService.getWidgetData(documentId, tabKey, widget.key, undefined)
    ),
    tap(() => {
      this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid);
    }),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 404) this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid);

      return of(null);
    })
  );

  constructor(
    private readonly widgetsService: WidgetsService,
    protected readonly documentService: DocumentService,
    protected readonly permissionService: PermissionService,
    private readonly caseTabService: CaseTabService,
    private readonly caseWidgetApiService: CaseWidgetsApiService,
    private readonly widgetLayoutService: WidgetLayoutService
  ) {
    super(documentService, permissionService);
  }

  public onProcessStartClick(process: WidgetAction): void {
    this.widgetsService.startProcess(process.processDefinitionKey);
  }
}
