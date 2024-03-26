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
import {BehaviorSubject, combineLatest, Subscription} from 'rxjs';
import {take} from 'rxjs/operators';
import {Dashboard, DashboardWidgetConfiguration, DisplayComponent, WidgetData} from '../../models';
import {WidgetService} from '../../services';
import {WidgetLayoutService} from '../../services/widget-layout.service';

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

  public readonly isLoading$ = new BehaviorSubject<boolean>(true);
  private _widgetData$ = new BehaviorSubject<WidgetData[]>([]);

  @Input() set widgetData(value: {data: WidgetData[]; loading: boolean}) {
    this.isLoading$.next(value.loading);
    this._widgetData$.next(value.data);
  }
  @Input() set dashboard(value: Dashboard) {
    this.setWidgetConfigurations(value);
  }

  public readonly widgetConfigurations$ =
    new BehaviorSubject<Array<DashboardWidgetConfiguration> | null>(null);

  private _observer!: ResizeObserver;
  private _subscriptions = new Subscription();

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
    this.openPackResultSubscription();
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

  private openPackResultSubscription(): void {
    this._subscriptions.add(
      this.layoutService.widgetPackResult$.subscribe(packResult => {
        this.renderer.setStyle(
          this._widgetContainerRef.nativeElement,
          'height',
          `${packResult.height}px`
        );

        this._widgetConfigurationRefs.toArray().forEach(widgetConfigurationRef => {
          const nativeElement = widgetConfigurationRef.nativeElement;
          const configPackResult = packResult.items.find(
            result => result.item.configurationKey === nativeElement.id
          );
          this.renderer.setStyle(nativeElement, 'height', `${configPackResult?.height}px`);
          this.renderer.setStyle(nativeElement, 'width', `${configPackResult?.width}px`);
          this.renderer.setStyle(nativeElement, 'left', `${configPackResult?.x}px`);
          this.renderer.setStyle(nativeElement, 'top', `${configPackResult?.y}px`);
        });
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
}
