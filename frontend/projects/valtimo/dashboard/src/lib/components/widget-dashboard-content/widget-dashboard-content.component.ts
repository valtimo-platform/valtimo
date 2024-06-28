/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
import {
  AfterViewInit,
  Component,
  ComponentRef,
  ElementRef,
  Input,
  OnDestroy,
  QueryList,
  Renderer2,
  ViewChild,
  ViewChildren,
  ViewContainerRef,
} from '@angular/core';
import {BehaviorSubject, combineLatest, Observable, Subscription} from 'rxjs';
import {delay, map, take} from 'rxjs/operators';
import {Dashboard, DashboardWidgetConfiguration, DisplayComponent, WidgetData} from '../../models';
import {WidgetService} from '../../services';
import {WidgetLayoutService} from '../../services/widget-layout.service';
import {WIDGET_1X_HEIGHT} from '../../constants';
import Muuri from 'muuri';

@Component({
  selector: 'valtimo-widget-dashboard-content',
  templateUrl: './widget-dashboard-content.component.html',
  styleUrls: ['./widget-dashboard-content.component.scss'],
  providers: [WidgetLayoutService],
})
export class WidgetDashboardContentComponent implements AfterViewInit, OnDestroy {
  @ViewChildren('widgetConfiguration') private _widgetConfigurationRefs: QueryList<
    ElementRef<HTMLDivElement>
  >;
  @ViewChildren('widgetConfigurationContent', {read: ViewContainerRef})
  private _widgetConfigurationContentVcRefs: QueryList<ViewContainerRef>;
  @ViewChild('widgetContainer') private _widgetContainerRef: ElementRef<HTMLDivElement>;

  private readonly _isLoading$ = new BehaviorSubject<boolean>(true);
  private _widgetData$ = new BehaviorSubject<WidgetData[]>([]);

  @Input() set widgetData(value: {data: WidgetData[]; loading: boolean}) {
    this._isLoading$.next(value.loading);
    this._widgetData$.next(value.data);
  }
  @Input() set dashboard(value: Dashboard) {
    this.setWidgetConfigurations(value);
  }

  public readonly widgetConfigurations$ =
    new BehaviorSubject<Array<DashboardWidgetConfiguration> | null>(null);

  private _observer!: ResizeObserver;
  private _subscriptions = new Subscription();

  private readonly _muuri$ = this.layoutService.muuriSubject$;

  private _creatingMuuri = false;

  private get _muuriInitialized$(): Observable<boolean> {
    return this._muuri$.pipe(map(muuri => !!muuri));
  }

  private readonly _noResults$ = new BehaviorSubject<boolean>(false);

  public readonly loaded$ = combineLatest([
    this._isLoading$,
    this._muuriInitialized$,
    this._noResults$,
  ]).pipe(
    map(
      ([isLoading, muuriInitialized, noResults]) => !isLoading && (muuriInitialized || noResults)
    ),
    delay(400)
  );

  constructor(
    private readonly layoutService: WidgetLayoutService,
    private readonly widgetService: WidgetService,
    private readonly renderer: Renderer2
  ) {}

  public ngAfterViewInit(): void {
    this._observer = new ResizeObserver(event => {
      this.observerMutation(event);
    });
    this._observer.observe(this._widgetContainerRef.nativeElement);
    this.openWidgetSizeSubscription();
    this.renderWidgets();
  }

  public ngOnDestroy(): void {
    this._observer?.disconnect();
    this._subscriptions?.unsubscribe();
  }

  private setWidgetConfigurations(dashboard: Dashboard): void {
    this.widgetService.supportedDisplayTypes$.pipe(take(1)).subscribe(supportedDisplayTypes => {
      const supportedWidgetConfigurations =
        dashboard.widgets?.filter(widgetConfiguration =>
          supportedDisplayTypes.find(
            type => type.displayTypeKey === widgetConfiguration.displayType
          )
        ) || [];
      this.layoutService.setWidgetConfigurations(supportedWidgetConfigurations);
      this.widgetConfigurations$.next(supportedWidgetConfigurations);
    });
  }

  private observerMutation(event: Array<ResizeObserverEntry>): void {
    const widgetContainerWidth = event[0]?.borderBoxSize[0]?.inlineSize;

    if (typeof widgetContainerWidth === 'number' && widgetContainerWidth !== 0) {
      this.layoutService.setWidgetContainerWidth(widgetContainerWidth);
    }
  }

  private openWidgetSizeSubscription(): void {
    this._subscriptions.add(
      combineLatest([
        this.layoutService.amountOfColumns$,
        this.widgetConfigurations$,
        this.widgetService.supportedDisplayTypes$,
        this._muuri$,
      ]).subscribe(([amountOfColumns, widgetConfigurations, supportedDisplayTypes, muuri]) => {
        this._widgetConfigurationRefs.toArray().forEach(widgetConfigurationRef => {
          const nativeElement = widgetConfigurationRef.nativeElement;
          const widgetConfiguration = widgetConfigurations.find(
            config => config.key === nativeElement.id
          );
          const specification = supportedDisplayTypes.find(
            type => type.displayTypeKey === widgetConfiguration.displayType
          );
          const widthPercentage =
            specification.width > amountOfColumns
              ? 100
              : (specification.width / amountOfColumns) * 100;
          this.renderer.setStyle(
            nativeElement,
            'height',
            `${WIDGET_1X_HEIGHT * specification.height}px`
          );
          this.renderer.setStyle(nativeElement, 'width', `${widthPercentage}%`);
        });

        if (widgetConfigurations.length > 0) {
          if (!muuri) {
            this.initMuuri();
          } else {
            this.layoutService.triggerMuuriLayout();
          }
        } else {
          this._noResults$.next(true);
        }
      })
    );
  }

  private renderWidgets(): void {
    this._subscriptions.add(
      combineLatest([
        this.widgetConfigurations$,
        this.widgetService.supportedDisplayTypes$,
        this._widgetData$,
      ]).subscribe(([configurations, displayTypes, data]) => {
        configurations?.forEach((configuration, index) => {
          const displayType = displayTypes.find(
            type => type.displayTypeKey === configuration.displayType
          );
          const vcRef = this._widgetConfigurationContentVcRefs.toArray()[index];

          if (displayType && data) {
            vcRef.clear();
            const componentInstance: ComponentRef<DisplayComponent> = vcRef.createComponent(
              displayType.displayComponent
            );
            componentInstance.setInput('displayTypeKey', configuration.displayType);
            componentInstance.setInput('displayTypeProperties', {
              ...configuration.displayTypeProperties,
            });

            componentInstance.setInput(
              'data',
              data.find(dataItem => dataItem.key === configuration.key)?.data
            );
          }
        });
      })
    );
  }

  private initMuuri(): void {
    if (!this._widgetContainerRef || this._creatingMuuri) return;

    this._creatingMuuri = true;

    this.layoutService.setMuuri(
      new Muuri(this._widgetContainerRef.nativeElement, {
        layout: {
          fillGaps: true,
        },
        layoutOnResize: false,
      })
    );

    this._creatingMuuri = false;
  }
}
