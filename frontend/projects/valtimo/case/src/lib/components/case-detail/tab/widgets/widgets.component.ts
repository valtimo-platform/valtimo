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
import {combineLatest, filter, map, Observable, shareReplay, startWith, switchMap} from 'rxjs';
import {CaseTabService, CaseWidgetsApiService} from '../../../../services';
import {
  BasicWidget,
  WidgetComponentMap,
  WidgetContainerComponent,
  WidgetType,
  DividerWidget,
  Widget,
  WidgetGroup,
} from '@valtimo/layout';
import {CaseWidgetFieldComponent} from './components/field/case-widget-field.component';
import {CaseWidgetCustomComponent} from './components/custom/case-widget-custom.component';
import {CaseWidgetFormioComponent} from './components/formio/case-widget-formio.component';
import {CaseWidgetTableComponent} from './components/table/case-widget-table.component';
import {CaseWidgetCollectionComponent} from './components/collection/case-widget-collection.component';
import {CaseWidgetMapComponent} from './components/map/case-widget-map.component';
import {CaseWidgetPersonCardComponent} from './components/person-card/case-widget-person-card.component';
import {CaseWidgetHighlightComponent} from './components/highlight/case-widget-highlight.component';
import {DocumentUpdatedSseEvent} from '../../../../models';
import {SseService} from '@valtimo/sse';
import {WidgetsService} from './widgets.service';
import {isEqual} from 'lodash-es';

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

  private readonly _documentUpdates$ = combineLatest([
    this.sseService.getSseEventObservable<DocumentUpdatedSseEvent>('DOCUMENT_UPDATED'),
    this._documentId$,
  ]).pipe(
    filter(([event, documentId]) => event.documentId === documentId),
    map(([event]) => event),
    startWith<DocumentUpdatedSseEvent | null>(null)
  );

  private _previousWidgetConfiguration: BasicWidget[] | null = null;

  private readonly _widgetConfiguration$ = combineLatest([
    this._documentId$,
    this._tabKey$,
    this._documentUpdates$,
  ]).pipe(
    switchMap(([documentId, tabKey, documentUpdatedEvent]) => {
      return this.filterDuplicateConfigurations(
        this.widgetsApiService.getWidgetTabConfiguration(documentId, tabKey),
        documentUpdatedEvent
      );
    }),
    shareReplay({bufferSize: 1, refCount: true})
  );

  public readonly widgetGroups$: Observable<WidgetGroup[]> = this._widgetConfiguration$.pipe(
    map(widgets => this.toCaseWidgetGroups(widgets))
  );

  public readonly widgetComponentMap: WidgetComponentMap = {
    [WidgetType.FIELDS]: CaseWidgetFieldComponent,
    [WidgetType.CUSTOM]: CaseWidgetCustomComponent,
    [WidgetType.FORMIO]: CaseWidgetFormioComponent,
    [WidgetType.TABLE]: CaseWidgetTableComponent,
    [WidgetType.INTERACTIVE_TABLE]: CaseWidgetTableComponent,
    [WidgetType.COLLECTION]: CaseWidgetCollectionComponent,
    [WidgetType.MAP]: CaseWidgetMapComponent,
    [WidgetType.PERSON_CARD]: CaseWidgetPersonCardComponent,
    [WidgetType.HIGHLIGHT]: CaseWidgetHighlightComponent,
  };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly caseTabService: CaseTabService,
    private readonly widgetsApiService: CaseWidgetsApiService,
    private readonly sseService: SseService,
    private readonly widgetsService: WidgetsService
  ) {}

  public ngOnInit(): void {
    this.caseTabService.disableTabHorizontalOverflow();
  }

  public ngOnDestroy(): void {
    this.caseTabService.enableTabHorizontalOverflow();
  }

  private toCaseWidgetGroups(widgets: BasicWidget[]): WidgetGroup[] {
    const groups = widgets.reduce<WidgetGroup[]>((acc, widget) => {
      if (widget.type === WidgetType.DIVIDER) {
        acc.push({divider: widget as DividerWidget, widgets: []});
      } else {
        if (acc.length === 0) acc.push({divider: null, widgets: []});
        acc[acc.length - 1].widgets.push(widget as Widget);
      }
      return acc;
    }, []);

    // if there is more than one group and trailing groups have only a divider and no widgets, don't render these last groups
    for (let i = groups.length - 1; i >= 0; i--) {
      if (groups[i].widgets.length === 0) {
        groups.pop();
      } else {
        break;
      }
    }

    return groups;
  }

  private filterDuplicateConfigurations(
    widgetConfiguration: Observable<BasicWidget[]>,
    documentUpdatedEvent: DocumentUpdatedSseEvent | null
  ): Observable<BasicWidget[]> {
    return widgetConfiguration.pipe(
      map(configuration => {
        const configurationChanged =
          !this._previousWidgetConfiguration ||
          !isEqual(this._previousWidgetConfiguration, configuration);

        if (!configurationChanged && documentUpdatedEvent) {
          this.widgetsService.refreshWidgets();
          return null;
        }

        if (configurationChanged) {
          this._previousWidgetConfiguration = configuration;
          return configuration;
        }

        return null;
      }),
      filter((configuration): configuration is BasicWidget[] => configuration !== null)
    );
  }
}
