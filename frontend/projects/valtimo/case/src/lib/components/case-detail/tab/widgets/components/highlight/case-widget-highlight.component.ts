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
import {HttpErrorResponse} from '@angular/common/http';
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {
  HighlightWidget,
  WidgetActionButtonComponent,
  WidgetHighlightComponent,
  WidgetLayoutService,
} from '@valtimo/layout';
import {BehaviorSubject, catchError, combineLatest, Observable, of, startWith, switchMap, tap} from 'rxjs';

import {CaseTabService, CaseWidgetsApiService} from '../../../../../../services';
import {WidgetsService} from '../../widgets.service';

@Component({
  selector: 'valtimo-case-widget-highlight',
  templateUrl: './case-widget-highlight.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    WidgetHighlightComponent,
    WidgetActionButtonComponent,
  ],
})
export class CaseWidgetHighlightComponent {
  private readonly _documentId$ = new BehaviorSubject<string>('');

  @Input({required: true}) public set documentId(value: string) {
    this._documentId$.next(value);
  }

  @Input() public set widgetConfiguration(value: HighlightWidget) {
    if (!value) return;
    this.widgetConfiguration$.next(value);
  }

  @Input() public readonly widgetUuid: string;

  public readonly widgetConfiguration$ = new BehaviorSubject<HighlightWidget | null>(null);

  private readonly _tabKey$: Observable<string> = this.caseTabService.activeTabKey$;
  private readonly _refresh$ = this.widgetsService.refreshWidgets$.pipe(startWith(null));

  public readonly widgetData$: Observable<object | null> = combineLatest([
    this.widgetConfiguration$,
    this._tabKey$,
    this._documentId$,
    this._refresh$,
  ]).pipe(
    switchMap(([widget, tabkey, documentId]) =>
      this.caseWidgetApiService.getWidgetData(documentId, tabkey, widget.key, undefined)
    ),
    tap(() => this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid)),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 404) this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid);
      return of(null);
    })
  );

  constructor(
    private readonly widgetsService: WidgetsService,
    private readonly caseTabService: CaseTabService,
    private readonly caseWidgetApiService: CaseWidgetsApiService,
    private readonly widgetLayoutService: WidgetLayoutService
  ) {}
}
