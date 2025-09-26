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

import {Injectable} from '@angular/core';
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  filter,
  map,
  Observable,
  Subject,
  Subscription,
} from 'rxjs';
import {DashboardWidgetConfiguration} from '../models';
import {WIDGET_1X_MIN_WIDTH} from '../constants';
import Muuri from 'muuri';

@Injectable()
export class WidgetLayoutService {
  private readonly _widgetContainerWidth$ = new BehaviorSubject<number | null>(null);
  private readonly _widgetConfigurations$ = new BehaviorSubject<
    Array<DashboardWidgetConfiguration>
  >([]);
  private readonly _muuriSubject$ = new BehaviorSubject<Muuri | null>(null);
  private readonly _triggerMuuriLayout$ = new Subject<null>();

  public get muuri$(): Observable<Muuri> {
    return this._muuriSubject$.pipe(filter(muuri => !!muuri));
  }

  public get muuriSubject$(): Observable<Muuri | null> {
    return this._muuriSubject$.asObservable();
  }

  private get widgetContainerWidth$(): Observable<number> {
    return this._widgetContainerWidth$.asObservable().pipe(filter(width => !!width));
  }

  public get amountOfColumns$(): Observable<number> {
    return this.widgetContainerWidth$.pipe(
      map(containerWidth => Math.floor(containerWidth / WIDGET_1X_MIN_WIDTH))
    );
  }

  private readonly _subscriptions = new Subscription();

  constructor() {
    this.openMuuriSubscription();
  }

  public setWidgetContainerWidth(width: number): void {
    this._widgetContainerWidth$.next(width);
  }

  public setWidgetConfigurations(configurations: Array<DashboardWidgetConfiguration>): void {
    this._widgetConfigurations$.next(configurations);
  }

  public setMuuri(muuri: Muuri): void {
    this._muuriSubject$.next(muuri);
  }

  public triggerMuuriLayout(): void {
    this._triggerMuuriLayout$.next(null);
  }

  private openMuuriSubscription(): void {
    this._subscriptions.add(
      combineLatest([this.muuri$, this._triggerMuuriLayout$])
        .pipe(debounceTime(150))
        .subscribe(([muuri]) => {
          muuri.refreshItems();
          muuri.layout();
        })
    );
  }
}
