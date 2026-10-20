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

import {Injectable} from '@angular/core';
import {BehaviorSubject, combineLatest, distinctUntilChanged, map, Observable, Subject} from 'rxjs';
import {SidePanelHandle, SidePanelOffer} from '../models';

const SIDE_PANEL_WIDTH_STORAGE_KEY = 'sidePanelWidth';
const SIDE_PANEL_DEFAULT_WIDTH = 480;
const SIDE_PANEL_MIN_WIDTH = 320;
const SIDE_PANEL_MAX_WIDTH = 960;

class SidePanelHandleImpl implements SidePanelHandle {
  private readonly _dismissed$ = new Subject<void>();
  private readonly _replaced$ = new Subject<void>();
  private readonly _resized$ = new Subject<number>();

  public readonly dismissed$ = this._dismissed$.asObservable();
  public readonly replaced$ = this._replaced$.asObservable();
  public readonly resized$ = this._resized$.asObservable();

  constructor(
    private readonly _onHide: (handle: SidePanelHandleImpl) => void,
    private readonly _onWithdraw: (handle: SidePanelHandleImpl) => void
  ) {}

  public hide(): void {
    this._onHide(this);
  }

  public withdraw(): void {
    this._onWithdraw(this);
  }

  public notifyDismissed(): void {
    this._dismissed$.next();
  }

  public notifyReplaced(): void {
    this._replaced$.next();
    this._dismissed$.complete();
    this._replaced$.complete();
    this._resized$.complete();
  }

  public notifyResized(width: number): void {
    this._resized$.next(width);
  }
}

/**
 * App-wide side panel next to the routed content. Knows nothing about what it shows: providers
 * offer content, the latest offer takes over. Dismissing only hides; the content stays alive until
 * withdrawn or replaced.
 */
@Injectable({
  providedIn: 'root',
})
export class SidePanelService {
  private readonly _current$ = new BehaviorSubject<SidePanelOffer | null>(null);
  private readonly _visible$ = new BehaviorSubject<boolean>(false);
  private readonly _preferredWidth$ = new BehaviorSubject<number>(this.loadWidth());
  /** Width of content that brings its own; such content persists it, not the panel. */
  private readonly _contentWidth$ = new BehaviorSubject<number | null>(null);
  private _currentHandle: SidePanelHandleImpl | null = null;

  public get current$(): Observable<SidePanelOffer | null> {
    return this._current$.asObservable();
  }

  public get visible$(): Observable<boolean> {
    return this._visible$.asObservable();
  }

  /** The content's own width or else the user's preferred width, widened to the content's minimum. */
  public get width$(): Observable<number> {
    return combineLatest([this._preferredWidth$, this._contentWidth$, this._current$]).pipe(
      map(([preferred, contentWidth, current]) =>
        this.clampWidth(Math.max(contentWidth ?? preferred, current?.minWidth ?? 0))
      ),
      distinctUntilChanged()
    );
  }

  public dismiss(): void {
    if (!this._visible$.getValue()) return;
    this._visible$.next(false);
    this._currentHandle?.notifyDismissed();
  }

  public offer(offer: SidePanelOffer): SidePanelHandle {
    const current = this._current$.getValue();

    if (this._currentHandle && current?.key === offer.key) {
      // Only a changed width from the provider wins over a resize it has not caught up with yet.
      if (offer.width !== current.width) this._contentWidth$.next(offer.width ?? null);
      this._current$.next(offer);
      this._visible$.next(true);
      return this._currentHandle;
    }

    this._currentHandle?.notifyReplaced();
    const handle = new SidePanelHandleImpl(
      hidden => this.hideHandle(hidden),
      withdrawn => this.withdrawHandle(withdrawn)
    );
    this._currentHandle = handle;
    this._contentWidth$.next(offer.width ?? null);
    this._current$.next(offer);
    this._visible$.next(true);
    return handle;
  }

  /**
   * Shows retained content again, also when hidden via `SidePanelHandle.hide()`. Does not notify
   * the provider.
   */
  public reopen(): void {
    if (this._current$.getValue()) this._visible$.next(true);
  }

  /** Withdraws the current content only when it still carries [key]. */
  public withdraw(key: string): void {
    if (this._current$.getValue()?.key === key && this._currentHandle) {
      this.withdrawHandle(this._currentHandle);
    }
  }

  /** Resizes live. Call [endResize] once the user lets go. */
  public setWidth(width: number): void {
    const clamped = this.clampWidth(width);

    if (this._contentWidth$.getValue() !== null) {
      this._contentWidth$.next(clamped);
      return;
    }

    this._preferredWidth$.next(clamped);
    localStorage.setItem(SIDE_PANEL_WIDTH_STORAGE_KEY, `${clamped}`);
  }

  /** Reports the final width to the provider of the current content. */
  public endResize(): void {
    this._currentHandle?.notifyResized(
      this._contentWidth$.getValue() ?? this._preferredWidth$.getValue()
    );
  }

  private clampWidth(width: number): number {
    const max = Math.min(SIDE_PANEL_MAX_WIDTH, Math.floor(window.innerWidth * 0.6));
    return Math.round(Math.max(SIDE_PANEL_MIN_WIDTH, Math.min(width, max)));
  }

  private hideHandle(handle: SidePanelHandleImpl): void {
    if (handle === this._currentHandle && this._visible$.getValue()) this._visible$.next(false);
  }

  private loadWidth(): number {
    const stored = Number(localStorage.getItem(SIDE_PANEL_WIDTH_STORAGE_KEY));
    return Number.isFinite(stored) && stored > 0
      ? this.clampWidth(stored)
      : SIDE_PANEL_DEFAULT_WIDTH;
  }

  private withdrawHandle(handle: SidePanelHandleImpl): void {
    if (handle !== this._currentHandle) return;
    this._currentHandle = null;
    this._contentWidth$.next(null);
    this._current$.next(null);
    this._visible$.next(false);
  }
}
