/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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

import {Injectable, OnDestroy} from '@angular/core';
import {BehaviorSubject, combineLatest, filter, map, Observable, Subscription} from 'rxjs';
import {WidgetService} from './widget.service';
import {DashboardWidgetConfiguration, PackResult, WidgetConfigurationBin} from '../models';
import {WIDGET_1X_HEIGHT, WIDGET_1X_MIN_WIDTH} from '../constants';
import pack from 'bin-pack-with-constraints';

@Injectable()
export class WidgetLayoutService implements OnDestroy {
  private readonly _widgetContainerWidth$ = new BehaviorSubject<number | null>(null);
  private readonly _widgetConfigurations$ = new BehaviorSubject<
    Array<DashboardWidgetConfiguration>
  >([]);
  private readonly _widgetPackResult$ = new BehaviorSubject<PackResult | null>(null);

  private _layoutSubscription!: Subscription;

  public get widgetPackResult$(): Observable<PackResult> {
    return this._widgetPackResult$.asObservable().pipe(filter(result => !!result));
  }

  private get widgetContainerWidth$(): Observable<number> {
    return this._widgetContainerWidth$.asObservable().pipe(filter(width => !!width));
  }

  private get widgetConfigurationBins$(): Observable<Array<WidgetConfigurationBin>> {
    return combineLatest([
      this.widgetService.supportedDisplayTypes$,
      this._widgetConfigurations$,
    ]).pipe(
      map(([displayTypes, configurations]) =>
        configurations.map(configuration => {
          const specification = displayTypes.find(
            type => type.displayTypeKey === configuration.displayType
          );
          return {
            configurationKey: configuration.key,
            width: specification.width,
            height: specification.height,
          };
        })
      )
    );
  }

  constructor(private readonly widgetService: WidgetService) {
    this.openLayoutSubscription();
  }

  ngOnDestroy(): void {
    this._layoutSubscription?.unsubscribe();
  }

  setWidgetContainerWidth(width: number): void {
    this._widgetContainerWidth$.next(width);
  }

  setWidgetConfigurations(configurations: Array<DashboardWidgetConfiguration>): void {
    this._widgetConfigurations$.next(configurations);
  }

  private openLayoutSubscription(): void {
    this._layoutSubscription = combineLatest([
      this.widgetContainerWidth$,
      this.widgetConfigurationBins$,
    ]).subscribe(([widgetContainerWidth, configurationBins]) => {
      const widget1xWidth = this.getWidget1xWidth(widgetContainerWidth);
      const binsToFit = configurationBins.map(configurationBin => ({
        ...configurationBin,
        width: configurationBin.width * widget1xWidth,
        height: configurationBin.height * WIDGET_1X_HEIGHT,
      }));
      const result: PackResult = pack(binsToFit, {maxWidth: widgetContainerWidth});
      const resultWithMaxWidth = this.getResultWithMaxWidth(result, widgetContainerWidth);

      this._widgetPackResult$.next(resultWithMaxWidth);
    });
  }

  private getWidget1xWidth(containerWidth: number): number {
    const amountOfMinWidthColumns = Math.floor(containerWidth / WIDGET_1X_MIN_WIDTH);
    const widget1xWidth = Math.floor(containerWidth / (amountOfMinWidthColumns || 1));

    return widget1xWidth;
  }

  private getResultWithMaxWidth(result: PackResult, containerWidth: number): PackResult {
    return {
      ...result,
      items: result.items.map(item => ({
        ...item,
        width: item.width > containerWidth ? containerWidth : item.width,
      })),
    };
  }
}
