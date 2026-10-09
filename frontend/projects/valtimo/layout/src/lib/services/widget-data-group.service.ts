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
import {BasicWidget, WidgetDataEnvelope, WidgetDataGroupResponse} from '../models';

interface WidgetDataGroupSource {
  fetchGroup(group: string): Observable<WidgetDataGroupResponse>;
  fetchWidget(widgetKey: string): Observable<any>;
}

/** Stands in for an envelope the backend could not produce, or did not return at all. */
const UPSTREAM_UNAVAILABLE: WidgetDataEnvelope = {error: {code: 'UPSTREAM_UNAVAILABLE'}};

/**
 * Serves widget data per group instead of per widget: one request per distinct upstream request.
 *
 * Provide per tab. A group is fetched on first subscription by one of its widgets, so paged
 * containers that keep their own request cost nothing here.
 *
 * Falls back to per-widget requests when `dataGroupId` is missing (older backend) or when a group
 * request fails, so an unrecognised group still renders data.
 *
 * Every widget is served an envelope rather than bare data, so a widget that could not be filled
 * is never handed the empty result of one that simply has nothing to show.
 */
@Injectable()
export class WidgetDataGroupService implements OnDestroy {
  private _source: WidgetDataGroupSource | null = null;
  private _groupOfWidget = new Map<string, string>();
  private _dataOfWidget = new Map<string, ReplaySubject<WidgetDataEnvelope>>();
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
      this._dataOfWidget.set(widget.key, new ReplaySubject<WidgetDataEnvelope>(1));
      if (grouped) this._groupOfWidget.set(widget.key, widget.dataGroupId);
    });
  }

  /**
   * This widget's data or its failure, requested on first subscription. The stream stays open:
   * every later result reaches the widget over it, including one a sibling's retry brought in.
   */
  public dataFor(widgetKey: string): Observable<WidgetDataEnvelope> {
    return defer(() => {
      const data$ = this.dataSubject(widgetKey);
      this.request(widgetKey);
      return data$.asObservable();
    });
  }

  /**
   * Re-runs requests into the same subjects: the one serving `widgetKey`, or every request made
   * so far when no widget is named.
   */
  public refresh(widgetKey?: string): void {
    if (!this._source) return;

    if (widgetKey === undefined) {
      this._requestedGroups.forEach(group => this.fetchGroup(group));
      this._requestedWidgets.forEach(requested => this.fetchWidget(requested));
      return;
    }

    const group = this._groupOfWidget.get(widgetKey);
    if (group) {
      this._requestedGroups.add(group);
      this.fetchGroup(group);
    } else {
      this._requestedWidgets.add(widgetKey);
      this.fetchWidget(widgetKey);
    }
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

  private dataSubject(widgetKey: string): ReplaySubject<WidgetDataEnvelope> {
    if (!this._dataOfWidget.has(widgetKey)) {
      this._dataOfWidget.set(widgetKey, new ReplaySubject<WidgetDataEnvelope>(1));
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
          // A widget the group left out got no data either — report it as a failure
          widgetKeys.forEach(key =>
            this.dataSubject(key).next(response[key] ?? UPSTREAM_UNAVAILABLE)
          );
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
        next: data => this.dataSubject(widgetKey).next({data}),
        error: () => this.dataSubject(widgetKey).next(UPSTREAM_UNAVAILABLE),
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
