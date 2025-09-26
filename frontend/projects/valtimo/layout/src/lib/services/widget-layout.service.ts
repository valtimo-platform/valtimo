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

import {Injectable, OnDestroy} from '@angular/core';
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  filter,
  map,
  Observable,
  Subject,
  Subscription,
  take,
} from 'rxjs';
import Muuri from 'muuri';
import {WidgetWithUuid} from '../models';
import {WIDGET_WIDTH_1X} from '../constants';

@Injectable({providedIn: 'root'})
export class WidgetLayoutService implements OnDestroy {
  private readonly _containerWidthSubject$ = new BehaviorSubject<number | null>(null);
  private readonly _widgetsSubject$ = new BehaviorSubject<WidgetWithUuid[] | null>(null);
  private readonly _widgetDataLoadedSubject$ = new BehaviorSubject<string[] | null>(null);
  private readonly _muuriSubject$ = new BehaviorSubject<Muuri | null>(null);
  private readonly _triggerMuuriLayout$ = new Subject<null>();

  private get _muuri$(): Observable<Muuri> {
    return this._muuriSubject$.pipe(filter(muuri => !!muuri));
  }

  private get _containerWidth$(): Observable<number> {
    return this._containerWidthSubject$.pipe(filter(width => width !== null));
  }

  public get amountOfColumns$(): Observable<number> {
    return this._containerWidth$.pipe(
      map(containerWidth => Math.floor(containerWidth / WIDGET_WIDTH_1X))
    );
  }

  private get _widgets$(): Observable<WidgetWithUuid[]> {
    return this._widgetsSubject$.pipe(filter(widgets => widgets !== null));
  }

  private get _widgetDataLoaded$(): Observable<string[]> {
    return this._widgetDataLoadedSubject$.pipe(filter(loaded => loaded !== null));
  }

  private readonly _widgetsWithExternalData$ = new BehaviorSubject<string[]>([]);
  private readonly _widgetsWithExternalDataReady$ = new BehaviorSubject<string[]>([]);

  private readonly _subscriptions = new Subscription();

  public get loaded$(): Observable<boolean> {
    return combineLatest([
      this._widgetDataLoaded$,
      this._widgets$,
      this._widgetsWithExternalData$,
      this._widgetsWithExternalDataReady$,
      this._containerWidth$,
    ]).pipe(
      map(
        ([widgetDataLoaded, widgets, widgetsWithExternalData, widgetsWithExternalDataReady]) =>
          widgetDataLoaded?.length === widgets.length &&
          widgetsWithExternalData.length === widgetsWithExternalDataReady.length
      ),
      filter(loaded => !!loaded)
    );
  }

  constructor() {
    this.openMuuriSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public setMuuri(muuri: Muuri): void {
    this._muuriSubject$.next(muuri);
  }

  public triggerMuuriLayout(): void {
    this._triggerMuuriLayout$.next(null);
  }

  public setWidgets(widgets: WidgetWithUuid[]): void {
    this._widgetsSubject$.next(widgets);
  }

  public setWidgetWithExternalData(uuid: string): void {
    this._widgetsWithExternalData$.pipe(take(1)).subscribe(widgetsWithExternalData => {
      this._widgetsWithExternalData$.next([...widgetsWithExternalData, uuid]);
    });
  }

  public setWidgetWithExternalDataReady(uuid: string): void {
    this._widgetsWithExternalDataReady$.pipe(take(1)).subscribe(widgetsWithExternalDataReady => {
      this._widgetsWithExternalDataReady$.next([...widgetsWithExternalDataReady, uuid]);
    });
  }

  public setContainerWidth(width: number): void {
    this._containerWidthSubject$.next(width);
  }

  public setWidgetDataLoaded(uuid: string): void {
    this._widgetDataLoadedSubject$.pipe(take(1)).subscribe(widgetDataLoaded => {
      if (!(widgetDataLoaded || []).includes(uuid)) {
        this._widgetDataLoadedSubject$.next([...(widgetDataLoaded || []), uuid]);
      }
    });
  }

  public reset(): void {
    this._containerWidthSubject$.next(null);
    this._widgetsSubject$.next(null);
    this._widgetDataLoadedSubject$.next(null);
    this._widgetsWithExternalData$.next([]);
    this._widgetsWithExternalDataReady$.next([]);
    this._muuriSubject$.next(null);
  }

  private openMuuriSubscription(): void {
    this._subscriptions.add(
      combineLatest([this._muuri$, this._triggerMuuriLayout$])
        .pipe(debounceTime(150))
        .subscribe(([muuri]) => {
          muuri.refreshItems();
          muuri.layout();
        })
    );
  }
}
