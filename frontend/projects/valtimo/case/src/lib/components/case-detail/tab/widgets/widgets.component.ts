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
import {ChangeDetectionStrategy, Component, HostBinding, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {CarbonListModule} from '@valtimo/components';
import {LoadingModule} from 'carbon-components-angular';
import {combineLatest, filter, map, Observable, switchMap} from 'rxjs';
import {CaseTabService, CaseWidgetsApiService} from '../../../../services';
import {WidgetComponentMap, WidgetContainerComponent, WidgetType} from '@valtimo/layout';
import {CaseWidgetFieldComponent} from './components/field/case-widget-field.component';
import {CaseWidgetCustomComponent} from './components/custom/case-widget-custom.component';
import {CaseWidgetFormioComponent} from './components/formio/case-widget-formio.component';
import {CaseWidgetTableComponent} from './components/table/case-widget-table.component';
import {CaseWidgetCollectionComponent} from './components/collection/case-widget-collection.component';

@Component({
  templateUrl: './widgets.component.html',
  styleUrls: ['./widgets.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    LoadingModule,
    WidgetContainerComponent,
    CarbonListModule,
    TranslateModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseDetailWidgetsComponent implements OnInit, OnDestroy {
  @HostBinding('class.tab--no-margin') private readonly _noMargin = true;
  @HostBinding('class.tab--no-background') private readonly _noBackground = true;
  @HostBinding('class.tab--no-min-height') private readonly _noMinHeight = true;

  private readonly _documentId$ = this.route.params.pipe(
    map(params => params?.documentId),
    filter(documentId => !!documentId)
  );

  private readonly _tabKey$: Observable<string> = this.caseTabService.activeTabKey$;

  public readonly widgetConfiguration$ = combineLatest([this._documentId$, this._tabKey$]).pipe(
    switchMap(([documentId, tabKey]) =>
      this.widgetsApiService.getWidgetTabConfiguration(documentId, tabKey)
    )
  );

  public readonly widgetComponentMap: WidgetComponentMap = {
    [WidgetType.FIELDS]: CaseWidgetFieldComponent,
    [WidgetType.CUSTOM]: CaseWidgetCustomComponent,
    [WidgetType.FORMIO]: CaseWidgetFormioComponent,
    [WidgetType.TABLE]: CaseWidgetTableComponent,
    [WidgetType.COLLECTION]: CaseWidgetCollectionComponent,
  };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly caseTabService: CaseTabService,
    private readonly widgetsApiService: CaseWidgetsApiService
  ) {}

  public ngOnInit(): void {
    this.caseTabService.disableTabHorizontalOverflow();
  }

  public ngOnDestroy(): void {
    this.caseTabService.enableTabHorizontalOverflow();
  }
}
