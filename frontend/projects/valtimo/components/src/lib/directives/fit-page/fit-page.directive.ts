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

import {
  AfterViewInit,
  Directive,
  ElementRef,
  Inject,
  Input,
  NgZone,
  OnDestroy,
  Renderer2,
  RendererStyleFlags2,
} from '@angular/core';
import {PageHeaderService} from '../../services';
import {combineLatest, fromEvent, Subscription} from 'rxjs';
import {startWith} from 'rxjs/operators';
import {DOCUMENT} from '@angular/common';

@Directive({selector: '[fitPage]', standalone: true})
export class FitPageDirective implements AfterViewInit, OnDestroy {
  /**
   * @deprecated Kept for backwards compatibility. The height is now derived from the element's
   * actual top offset, which already accounts for any content above it, so this is no longer
   * needed. New usages should rely on `bottomMargin` instead.
   */
  @Input() spaceAdjustment: number = 0;
  @Input() fitPageDisabled = false;
  @Input() disableOverflow = false;
  /**
   * Amount of whitespace (in px) kept between the element's bottom edge and the viewport bottom.
   * The height is computed from the element's actual top offset, so this gap is preserved
   * regardless of header height, compact mode, or any content rendered above the element.
   */
  @Input() bottomMargin = 24;

  private readonly _subscriptions = new Subscription();
  private _rafId: number | null = null;
  private _lastTopOffset: number | null = null;
  private _settleFrames = 0;

  constructor(
    private readonly elementRef: ElementRef,
    private readonly pageHeaderService: PageHeaderService,
    private readonly renderer: Renderer2,
    private readonly ngZone: NgZone,
    @Inject(DOCUMENT) private readonly document: Document
  ) {}

  public ngAfterViewInit(): void {
    // Run outside Angular: the recompute only mutates styles, so it should not trigger change
    // detection on every header update, window resize, or animation frame.
    this.ngZone.runOutsideAngular(() => {
      this._subscriptions.add(
        // pageHeadHeight$/compactMode$ recompute when the header changes; the window resize
        // trigger recomputes when chrome above the element reflows at a different viewport size.
        combineLatest([
          this.pageHeaderService.pageHeadHeight$,
          this.pageHeaderService.compactMode$,
          fromEvent(window, 'resize').pipe(startWith(null)),
        ]).subscribe(() => this.scheduleFitPageHeight())
      );
    });
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this.cancelScheduledFrame();
    this.removeDocumentOverflowStyle();
  }

  /**
   * Measures on the next frame(s) instead of synchronously, then keeps re-measuring until the
   * element's top offset stops changing. Content above the element (tabs, toolbars, async
   * editors) may not have laid out yet when the trigger fires, so the first measurement can be
   * stale — previously this only corrected itself after a manual window resize.
   */
  private scheduleFitPageHeight(): void {
    this._settleFrames = 0;
    this._lastTopOffset = null;
    this.queueFrame();
  }

  private queueFrame(): void {
    this.cancelScheduledFrame();
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      const settled = this.applyFitPageHeight();

      if (!settled && this._settleFrames < 10) {
        this._settleFrames++;
        this.queueFrame();
      }
    });
  }

  private cancelScheduledFrame(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /** Applies the height and returns whether the top offset has stabilized since the last frame. */
  private applyFitPageHeight(): boolean {
    const nativeElement = this.elementRef?.nativeElement;

    if (!nativeElement || this.fitPageDisabled) {
      this.removeDocumentOverflowStyle();
      return true;
    }

    this.addDocumentOverflowStyle();

    const topOffset = Math.round(nativeElement.getBoundingClientRect().top);
    const settled = topOffset === this._lastTopOffset;
    this._lastTopOffset = topOffset;

    this.renderer.setStyle(
      nativeElement,
      'height',
      `calc(100vh - ${topOffset + this.spaceAdjustment + this.bottomMargin}px)`
    );

    return settled;
  }

  private addDocumentOverflowStyle(): void {
    if (!this.disableOverflow) return;

    this.renderer.setStyle(
      this.document.documentElement,
      'overflow',
      'hidden',
      RendererStyleFlags2.Important
    );
  }

  private removeDocumentOverflowStyle(): void {
    if (!this.disableOverflow) return;

    this.renderer.removeStyle(this.document.documentElement, 'overflow');
  }
}
