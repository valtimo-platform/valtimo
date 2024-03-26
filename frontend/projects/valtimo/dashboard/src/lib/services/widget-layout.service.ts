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
      const amountOfMinWidthColumns = this.getAmountOfMinWidthColumns(widgetContainerWidth);
      const widget1xWidth = this.getWidget1xWidth(widgetContainerWidth, amountOfMinWidthColumns);
      const binsToFit = configurationBins.map(configurationBin => ({
        ...configurationBin,
        width: configurationBin.width * widget1xWidth,
        height: configurationBin.height * WIDGET_1X_HEIGHT,
      }));
      const heightConstraint = this.getHeightConstraint(configurationBins, amountOfMinWidthColumns);
      const resultWithoutHeightConstraint = this.getPackResult(binsToFit, widgetContainerWidth);
      const resultWithHeightConstraint = this.getPackResult(
        binsToFit,
        widgetContainerWidth,
        heightConstraint
      );
      const resultWithHeightConstraintExceedsBoundary = this.checkIfPackResultExceedsBoundary(
        resultWithHeightConstraint,
        widgetContainerWidth
      );
      const resultToUse = resultWithHeightConstraintExceedsBoundary
        ? resultWithoutHeightConstraint
        : resultWithHeightConstraint;
      const resultWithMaxWidth = this.getResultWithMaxWidth(resultToUse, widgetContainerWidth);

      this._widgetPackResult$.next(resultWithMaxWidth);
    });
  }

  private getPackResult(
    binsToFit: Array<WidgetConfigurationBin>,
    maxWidth: number,
    maxHeight?: number
  ): PackResult {
    return pack(binsToFit, {
      maxWidth,
      ...(maxHeight && {maxHeight}),
    });
  }

  private checkIfPackResultExceedsBoundary(result: PackResult, maxWidth: number): boolean {
    return !!result.items.find(item => item.width + item.x > maxWidth);
  }

  private getAmountOfMinWidthColumns(containerWidth: number): number {
    return Math.floor(containerWidth / WIDGET_1X_MIN_WIDTH);
  }

  private getWidget1xWidth(containerWidth: number, amountOfMinWidthColumns: number): number {
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

  private getHeightConstraint(
    binsToFit: Array<WidgetConfigurationBin>,
    amountOfMinWidthColumns: number
  ): number {
    const amountOfSpacesNeeded = binsToFit.reduce((acc, curr) => acc + curr.height * curr.width, 0);
    const minAmountOfRowsNeeded = Math.ceil(amountOfSpacesNeeded / amountOfMinWidthColumns);
    const tallestWidgetHeightSpace = binsToFit.reduce(
      (acc, curr) => (curr.height > acc ? curr.height : acc),
      0
    );
    const amountOfRowsNeeded =
      minAmountOfRowsNeeded < tallestWidgetHeightSpace
        ? tallestWidgetHeightSpace
        : minAmountOfRowsNeeded;

    return amountOfRowsNeeded * WIDGET_1X_HEIGHT;
  }
}
