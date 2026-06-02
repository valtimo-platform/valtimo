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
  Input,
  NgZone,
  OnDestroy,
  Renderer2,
} from '@angular/core';
import Muuri from 'muuri';
import {BehaviorSubject, combineLatest, fromEvent, Observable, Subscription, switchMap} from 'rxjs';
import {distinctUntilChanged, filter, take, tap} from 'rxjs/operators';
import {muuriGapFreeLayout} from './muuri-gap-free-layout';

@Directive({
  selector: '[muuri]',
  standalone: true,
})
export class MuuriDirective implements AfterViewInit, OnDestroy {
  @Input() public readonly columnMinWidth = 250;

  private readonly _muuriSubject$ = new BehaviorSubject<Muuri | null>(null);
  private readonly _containerWidthSubject$ = new BehaviorSubject<number>(0);
  private readonly _mutationTrigger$ = new BehaviorSubject<null>(null);

  private _containerResizeObserver?: ResizeObserver;
  private _itemResizeObserver?: ResizeObserver;
  private _mutationObserver?: MutationObserver;
  private _layoutDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly _subscriptions = new Subscription();

  private get _muuri$(): Observable<Muuri> {
    return this._muuriSubject$.pipe(filter((muuri): muuri is Muuri => !!muuri));
  }

  private get _muuri(): Muuri | null {
    return this._muuriSubject$.getValue();
  }

  private get _containerWidth$(): Observable<number> {
    return this._containerWidthSubject$.pipe(distinctUntilChanged());
  }

  constructor(
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly renderer: Renderer2,
    private readonly ngZone: NgZone
  ) {}

  public ngAfterViewInit(): void {
    this.setContainerStyles();
    this.observeContainerWidthChanges();
    this.observeMutations();

    this.ngZone.runOutsideAngular(() => {
      this.ngZone.onStable.pipe(take(1)).subscribe(() => {
        const nativeElement = this.elementRef.nativeElement;

        if (
          !nativeElement ||
          !(nativeElement instanceof HTMLElement) ||
          !nativeElement.isConnected
        ) {
          console.warn(
            'MuuriDirective: container element is not an attached HTMLElement; skipping Muuri init.'
          );
          return;
        }

        this.initMuuri();
        this.initItemResizeObserver();
        this.openContainerChangeSubscription();
        this._mutationTrigger$.next(null);
      });
    });
  }

  public ngOnDestroy(): void {
    this._containerResizeObserver?.disconnect();
    this._itemResizeObserver?.disconnect();
    this._mutationObserver?.disconnect();
    if (this._layoutDebounceTimer) clearTimeout(this._layoutDebounceTimer);
    this._subscriptions.unsubscribe();
    this._muuriSubject$.value?.destroy?.();
  }

  private initMuuri(): void {
    const nativeElement = this.elementRef.nativeElement;

    if (!nativeElement || !(nativeElement instanceof HTMLElement)) {
      console.warn('MuuriDirective: cannot initialize Muuri, nativeElement is not an HTMLElement.');
      return;
    }

    this._muuriSubject$.next(
      new Muuri(nativeElement, {
        layout: muuriGapFreeLayout,
        layoutOnResize: false,
      })
    );
  }

  /**
   * Create a ResizeObserver that watches each direct child (Muuri item) for
   * size changes. This catches image loads, async content rendering, font
   * loading, and any other change that alters an item's height without
   * triggering a DOM mutation.
   */
  private initItemResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') return;

    this._itemResizeObserver = new ResizeObserver(() => {
      this.debouncedLayout();
    });

    this.observeCurrentItems();
  }

  /**
   * Start observing all current direct children that are not yet observed.
   * Called on init and whenever the MutationObserver detects new children.
   */
  private observeCurrentItems(): void {
    if (!this._itemResizeObserver) return;

    const container = this.elementRef.nativeElement as HTMLElement;
    Array.from(container.children).forEach(child => {
      this._itemResizeObserver!.observe(child);
    });
  }

  /**
   * Debounced refresh + layout to batch rapid item size changes (e.g. multiple
   * images loading in quick succession) into a single Muuri re-layout.
   */
  private debouncedLayout(): void {
    if (this._layoutDebounceTimer) clearTimeout(this._layoutDebounceTimer);

    this._layoutDebounceTimer = setTimeout(() => {
      this._layoutDebounceTimer = null;
      if (this._muuri) {
        this._muuri.refreshItems();
        this._muuri.layout(true);
      }
    }, 200);
  }

  private observeContainerWidthChanges(): void {
    const nativeElement = this.elementRef.nativeElement as HTMLElement;

    const getWidth = () => {
      const width = nativeElement.offsetWidth;
      this._containerWidthSubject$.next(width);
    };

    if (typeof ResizeObserver !== 'undefined') {
      this._containerResizeObserver = new ResizeObserver(() => getWidth());
      this._containerResizeObserver.observe(nativeElement);
    }

    if (typeof window !== 'undefined') {
      this._subscriptions.add(fromEvent(window, 'resize').subscribe(() => getWidth()));
    }

    getWidth();
  }

  private observeMutations(): void {
    if (typeof MutationObserver === 'undefined') {
      return;
    }

    const nativeElement = this.elementRef.nativeElement as HTMLElement;

    this._mutationObserver = new MutationObserver(() => {
      if (!this._muuri) return;

      const container = this.elementRef.nativeElement as HTMLElement;
      const items = Array.from(container.children).filter(
        el => !this._muuri!.getItems().some(item => item.getElement() === el)
      ) as HTMLElement[];

      if (items.length > 0) {
        this._muuri.add(items);
      }

      // Ensure newly added items are observed for size changes
      this.observeCurrentItems();

      this._mutationTrigger$.next(null);
    });

    this._mutationObserver.observe(nativeElement, {
      childList: true,
      subtree: true,
    });
  }

  private openContainerChangeSubscription(): void {
    this._subscriptions.add(
      combineLatest([this._containerWidth$, this._mutationTrigger$])
        .pipe(
          tap(([containerWidth]) => {
            const nativeElement = this.elementRef.nativeElement as HTMLElement;
            const children = Array.from(nativeElement.children) as HTMLElement[];

            const amountOfHorizontalElements = Math.floor(containerWidth / this.columnMinWidth);

            const widthPerElement =
              amountOfHorizontalElements > 1
                ? Math.min(containerWidth / amountOfHorizontalElements)
                : containerWidth;

            children.forEach(item => {
              item.style.setProperty('position', 'absolute');
              item.style.setProperty('width', `${widthPerElement}px`);
            });
          }),
          switchMap(() => this._muuri$),
          tap(muuri => {
            muuri.refreshItems();
            muuri.layout(true);
          })
        )
        .subscribe()
    );
  }

  private setContainerStyles(): void {
    const el = this.elementRef.nativeElement as HTMLElement;

    const computedPosition = getComputedStyle(el).position;

    if (!computedPosition || computedPosition === 'static') {
      this.renderer.setStyle(el, 'position', 'relative');
    }

    this.renderer.setStyle(el, 'margin', '-8px');
  }
}
