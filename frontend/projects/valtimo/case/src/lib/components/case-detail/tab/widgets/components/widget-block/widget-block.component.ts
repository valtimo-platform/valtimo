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
import {HttpErrorResponse} from '@angular/common/http';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  Renderer2,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {
  CARBON_THEME,
  CarbonListModule,
  CdsThemeService,
  CurrentCarbonTheme,
} from '@valtimo/components';
import {LoadingModule, TilesModule} from 'carbon-components-angular';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  filter,
  map,
  Observable,
  of,
  Subscription,
  switchMap,
  tap,
} from 'rxjs';
import {CaseWidgetType, CaseWidgetWithUuid, WidgetTableContent} from '../../../../../../models';
import {
  CaseTabService,
  CaseWidgetsApiService,
  CaseWidgetsLayoutService,
} from '../../../../../../services';
import {CaseWidgetCustomComponent} from '../custom/case-widget-custom.component';
import {CaseWidgetFieldComponent} from '../field/case-widget-field.component';
import {CaseWidgetFormioComponent} from '../formio/case-widget-formio.component';
import {CaseWidgetTableComponent} from '../table/case-widget-table.component';
import {CaseWidgetCollectionComponent} from '../collection/case-widget-collection.component';
import {WIDGET_HEIGHT_1X} from '../../../../../../constants';

@Component({
  selector: 'valtimo-case-widget-block',
  templateUrl: './widget-block.component.html',
  styleUrls: ['./widget-block.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    LoadingModule,
    CaseWidgetTableComponent,
    CaseWidgetCustomComponent,
    CarbonListModule,
    TranslateModule,
    TilesModule,
    CaseWidgetFieldComponent,
    CaseWidgetFormioComponent,
    CaseWidgetCollectionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetBlockComponent implements AfterViewInit, OnDestroy {
  @ViewChild('widgetBlockContent') private _widgetBlockContentRef: ElementRef<HTMLDivElement>;

  @Input() public set widget(value: CaseWidgetWithUuid) {
    this._widgetUuid = value.uuid;
    this._widget$.next(value);
  }

  private readonly _widget$ = new BehaviorSubject<CaseWidgetWithUuid | null>(null);

  public get widget$(): Observable<CaseWidgetWithUuid> {
    return this._widget$.pipe(filter(widget => widget !== null));
  }

  private readonly _viewContainerRefSubject$ = new BehaviorSubject<ViewContainerRef | null>(null);

  private get _viewContainerRef$(): Observable<ViewContainerRef> {
    return this._viewContainerRefSubject$.pipe(filter(ref => !!ref));
  }

  private readonly _contentHeight$ = new BehaviorSubject<number>(0);

  public readonly blockHeightPx$ = combineLatest([
    this._contentHeight$,
    this._viewContainerRef$,
  ]).pipe(
    filter(([contentHeight]) => contentHeight !== 0),
    tap(([contentHeight, viewRef]) => {
      const blockHeight = Math.ceil((contentHeight + 16) / WIDGET_HEIGHT_1X) * WIDGET_HEIGHT_1X;

      this.renderer.setStyle(viewRef.element.nativeElement, 'height', `${blockHeight}px`);
      this.caseWidgetsLayoutService.triggerMuuriLayout();
    })
  );

  public readonly blockWidthPercentage$ = combineLatest([
    this.caseWidgetsLayoutService.amountOfColumns$,
    this.widget$,
    this._viewContainerRef$,
  ]).pipe(
    tap(([amountOfColumns, widget, viewRef]) => {
      const percentage =
        widget.width > amountOfColumns ? 100 : (widget.width / amountOfColumns) * 100;

      this.renderer.setStyle(viewRef.element.nativeElement, 'width', `${percentage}%`);
      this.caseWidgetsLayoutService.triggerMuuriLayout();
    })
  );

  public readonly CaseWidgetType = CaseWidgetType;

  public readonly documentId$ = this.route.params.pipe(
    map(params => params?.documentId),
    filter(documentId => !!documentId)
  );

  public readonly tabKey$: Observable<string> = this.caseTabService.activeTabKey$;

  public readonly widgetData$: Observable<any[] | {} | null> = combineLatest([
    this.widget$,
    this.tabKey$,
    this.documentId$,
  ]).pipe(
    switchMap(([widget, tabkey, documentId]) =>
      // custom component and formio widgets do not fetch additional data
      widget.type === CaseWidgetType.CUSTOM || widget.type === CaseWidgetType.FORMIO
        ? of({})
        : this.widgetsApiService.getWidgetData(
            documentId,
            tabkey,
            widget.key,
            widget.type === CaseWidgetType.TABLE || widget.type === CaseWidgetType.COLLECTION
              ? this.getPageSizeParam(widget)
              : undefined
          )
    ),
    tap(() => {
      this.caseWidgetsLayoutService.setCaseWidgetDataLoaded(this._widgetUuid);
    }),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 404)
        this.caseWidgetsLayoutService.setCaseWidgetDataLoaded(this._widgetUuid);

      return of(null);
    })
  );

  public readonly theme$ = combineLatest([this.cdsThemeService.currentTheme$, this.widget$]).pipe(
    map(([currentTheme, widgetConfiguration]) => {
      return currentTheme === CurrentCarbonTheme.G10
        ? widgetConfiguration.highContrast
          ? CARBON_THEME.G100
          : CARBON_THEME.G10
        : widgetConfiguration.highContrast
          ? CARBON_THEME.WHITE
          : CARBON_THEME.G90;
    })
  );

  private readonly _subscriptions = new Subscription();

  private _observer!: ResizeObserver;

  private _widgetUuid!: string;

  constructor(
    private readonly caseWidgetsLayoutService: CaseWidgetsLayoutService,
    private readonly caseTabService: CaseTabService,
    private readonly route: ActivatedRoute,
    private readonly widgetsApiService: CaseWidgetsApiService,
    private readonly cdsThemeService: CdsThemeService,
    private readonly renderer: Renderer2,
    private readonly viewRef: ViewContainerRef
  ) {}

  public ngAfterViewInit(): void {
    this._viewContainerRefSubject$.next(this.viewRef);
    this.openContentHeightObserver();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this._observer?.disconnect();
  }

  private openContentHeightObserver(): void {
    this._observer = new ResizeObserver(event => {
      this.observerMutation(event);
    });
    this._observer.observe(this._widgetBlockContentRef.nativeElement);
  }

  private observerMutation(event: Array<ResizeObserverEntry>): void {
    const widgetContentHeight = event[0]?.borderBoxSize[0]?.blockSize;

    if (typeof widgetContentHeight === 'number' && widgetContentHeight !== 0) {
      this._contentHeight$.next(widgetContentHeight);
    }
  }

  private getPageSizeParam(widgetConfiguration: CaseWidgetWithUuid): string {
    return `size=${(widgetConfiguration.properties as WidgetTableContent).defaultPageSize}`;
  }
}
