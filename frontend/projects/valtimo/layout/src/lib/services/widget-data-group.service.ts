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

import {Injectable, OnDestroy} from '@angular/core';
import {defer, Observable, ReplaySubject, Subscription} from 'rxjs';
import {BasicWidget, WidgetDataGroupResponse} from '../models';

interface WidgetDataGroupSource {
  fetchGroup(group: string): Observable<WidgetDataGroupResponse>;
  fetchWidget(widgetKey: string): Observable<any>;
}

/**
 * Serves widget data per group instead of per widget: one request per distinct upstream request.
 *
 * Provide per tab. A group is fetched on first subscription by one of its widgets, so paged
 * containers that keep their own request cost nothing here.
 *
 * Falls back to per-widget requests when `dataGroupId` is missing (older backend) or when a group
 * request fails, so an unrecognised group still renders data.
 */
@Injectable()
export class WidgetDataGroupService implements OnDestroy {
  private _source: WidgetDataGroupSource | null = null;
  private _groupOfWidget = new Map<string, string>();
  private _dataOfWidget = new Map<string, ReplaySubject<any>>();
  private _requestedGroups = new Set<string>();
  private _requestedWidgets = new Set<string>();

  /** Keyed by group id, or by widget key for per-widget requests. */
  private _inFlight = new Map<string, Subscription>();

  public setSource(source: WidgetDataGroupSource): void {
    this._source = source;
  }

  public setWidgets(widgets: BasicWidget[]): void {
    this.reset();

    const grouped = widgets.every(widget => !!widget.dataGroupId);
    widgets.forEach(widget => {
      this._dataOfWidget.set(widget.key, new ReplaySubject<any>(1));
      if (grouped) this._groupOfWidget.set(widget.key, widget.dataGroupId);
    });
  }

  public dataFor<T = any>(widgetKey: string): Observable<T> {
    return defer(() => {
      const data$ = this.dataSubject(widgetKey);
      this.request(widgetKey);
      return data$ as Observable<T>;
    });
  }

  /** Re-runs every request made so far, into the same subjects. */
  public refresh(): void {
    this._requestedGroups.forEach(group => this.fetchGroup(group));
    this._requestedWidgets.forEach(widgetKey => this.fetchWidget(widgetKey));
  }

  public reset(): void {
    this.cancelAll();
    this._groupOfWidget.clear();
    this._dataOfWidget.clear();
    this._requestedGroups.clear();
    this._requestedWidgets.clear();
  }

  public ngOnDestroy(): void {
    this.cancelAll();
  }

  private dataSubject(widgetKey: string): ReplaySubject<any> {
    if (!this._dataOfWidget.has(widgetKey)) {
      this._dataOfWidget.set(widgetKey, new ReplaySubject<any>(1));
    }

    return this._dataOfWidget.get(widgetKey);
  }

  private request(widgetKey: string): void {
    if (!this._source) return;

    const group = this._groupOfWidget.get(widgetKey);
    if (!group) {
      if (this._requestedWidgets.has(widgetKey)) return;
      this._requestedWidgets.add(widgetKey);
      this.fetchWidget(widgetKey);
      return;
    }

    if (this._requestedGroups.has(group)) return;
    this._requestedGroups.add(group);
    this.fetchGroup(group);
  }

  private widgetsOfGroup(group: string): string[] {
    return [...this._groupOfWidget.entries()]
      .filter(([, widgetGroup]) => widgetGroup === group)
      .map(([widgetKey]) => widgetKey);
  }

  private fetchGroup(group: string): void {
    const widgetKeys = this.widgetsOfGroup(group);

    this.track(group, () =>
      this._source.fetchGroup(group).subscribe({
        next: response => {
          // An error envelope has no data — the widget renders as if it got none
          widgetKeys.forEach(key => this.dataSubject(key).next(response[key]?.data ?? null));
        },
        // Demote for good, so dataFor and refresh keep working per widget
        error: () => {
          this._requestedGroups.delete(group);
          widgetKeys.forEach(key => {
            this._groupOfWidget.delete(key);
            this._requestedWidgets.add(key);
            this.fetchWidget(key);
          });
        },
      })
    );
  }

  private fetchWidget(widgetKey: string): void {
    this.track(widgetKey, () =>
      this._source.fetchWidget(widgetKey).subscribe({
        next: data => this.dataSubject(widgetKey).next(data),
        error: () => this.dataSubject(widgetKey).next(null),
      })
    );
  }

  /** Supersedes any request running for this key, so a stale response cannot land. */
  private track(key: string, start: () => Subscription): void {
    this._inFlight.get(key)?.unsubscribe();
    this._inFlight.set(key, start());
  }

  private cancelAll(): void {
    this._inFlight.forEach(subscription => subscription.unsubscribe());
    this._inFlight.clear();
  }
}

export {WidgetDataGroupSource};
