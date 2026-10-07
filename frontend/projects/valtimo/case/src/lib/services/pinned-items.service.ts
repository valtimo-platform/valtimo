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

import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {ConfigService} from '@valtimo/shared';
import {BehaviorSubject, catchError, defer, distinctUntilChanged, map, Observable, of} from 'rxjs';
import {PinnedItem, PinnedItemType} from '../models';

/**
 * Case groups and case types the user pinned to the menu. The backend owns the list: it resolves
 * the display name and colour, and leaves out what the user may no longer see.
 */
@Injectable({providedIn: 'root'})
export class PinnedItemsService {
  private readonly _endpointUri: string;
  private readonly _pinnedItems$ = new BehaviorSubject<PinnedItem[]>([]);

  private _loadStarted = false;

  /**
   * Loads on first subscription, not on construction: this service is created while the app is
   * still starting up, and the API answers 403 until authentication is in place.
   */
  public readonly pinnedItems$: Observable<PinnedItem[]> = defer(() => {
    this.loadPinnedItems();

    return this._pinnedItems$;
  });

  /** Emits only when the set of pinned items itself changes, for consumers that reload on it. */
  public readonly pinnedItemKeys$: Observable<string> = this.pinnedItems$.pipe(
    map(items =>
      items
        .map(item => this.getItemId(item.itemType, item.itemKey))
        .sort()
        .join('|')
    ),
    distinctUntilChanged()
  );

  constructor(
    private readonly configService: ConfigService,
    private readonly http: HttpClient
  ) {
    this._endpointUri = `${this.configService.config.valtimoApi.endpointUri}v1/pinned-item`;
  }

  public isPinned(itemType: PinnedItemType, itemKey: string): boolean {
    return this._pinnedItems$
      .getValue()
      .some(item => item.itemType === itemType && item.itemKey === itemKey);
  }

  public togglePinnedItem(itemType: PinnedItemType, itemKey: string): void {
    const current = this._pinnedItems$.getValue();
    const pinned = this.isPinned(itemType, itemKey);

    // Applied right away so the click feels instant; the backend answer replaces it.
    this._pinnedItems$.next(
      pinned
        ? current.filter(item => !(item.itemType === itemType && item.itemKey === itemKey))
        : [{itemType, itemKey, order: 0}, ...current]
    );

    const request = pinned
      ? this.http.delete<void>(`${this._endpointUri}/${itemType}/${itemKey}`)
      : this.http.post<void>(this._endpointUri, {itemType, itemKey});

    request.subscribe({
      next: () => this.fetchPinnedItems(),
      error: () => this._pinnedItems$.next(current),
    });
  }

  /** Re-fetches after a pinned item's name or colour changed elsewhere. */
  public refresh(): void {
    if (!this._loadStarted) return;

    this.fetchPinnedItems();
  }

  private getItemId(itemType: PinnedItemType, itemKey: string): string {
    return `${itemType}:${itemKey}`;
  }

  private loadPinnedItems(): void {
    if (this._loadStarted) return;

    this._loadStarted = true;
    this.fetchPinnedItems();
  }

  private fetchPinnedItems(): void {
    this.http
      .get<PinnedItem[]>(this._endpointUri)
      .pipe(catchError(() => of([] as PinnedItem[])))
      .subscribe(pinnedItems =>
        this._pinnedItems$.next(
          [...pinnedItems].sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
        )
      );
  }
}
