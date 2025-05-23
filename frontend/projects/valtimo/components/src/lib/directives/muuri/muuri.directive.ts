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

import {AfterViewInit, Directive, ElementRef, Input, OnDestroy, Renderer2} from '@angular/core';
import Muuri from 'muuri';
import {BehaviorSubject, combineLatest, fromEvent, Observable, Subscription, switchMap} from 'rxjs';
import {distinctUntilChanged, filter, tap} from 'rxjs/operators';

@Directive({
  selector: '[muuri]',
  standalone: true,
})
export class MuuriDirective implements AfterViewInit, OnDestroy {
  @Input() public readonly columnMinWidth = 250;

  private readonly _muuriSubject$ = new BehaviorSubject<Muuri | null>(null);
  private readonly _containerWidthSubject$ = new BehaviorSubject<number>(0);
  private readonly _mutationTrigger$ = new BehaviorSubject<null>(null);

  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;

  private get _muuri$(): Observable<Muuri> {
    return this._muuriSubject$.pipe(filter(muuri => !!muuri));
  }

  private get _muuri(): Muuri {
    return this._muuriSubject$.getValue();
  }

  private get _containerWidth$(): Observable<number> {
    return this._containerWidthSubject$.pipe(distinctUntilChanged());
  }

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly elementRef: ElementRef,
    private readonly renderer: Renderer2
  ) {}

  public ngAfterViewInit(): void {
    this.setContainerStyles();
    this.observeContainerWidthChanges();
    this.observeMutations();
    this.initMuuri();
    this.openContainerChangeSubscription();
    this.setContainerStyles();
  }

  public ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    this._subscriptions.unsubscribe();
  }

  private initMuuri(): void {
    this._muuriSubject$.next(
      new Muuri(this.elementRef.nativeElement, {
        layout: {
          fillGaps: true,
        },
        layoutOnResize: false,
      })
    );
  }

  private observeContainerWidthChanges(): void {
    const nativeElement = this.elementRef.nativeElement as HTMLElement;

    const getWidth = () => {
      const width = nativeElement.offsetWidth;
      this._containerWidthSubject$.next(width);
    };

    this.resizeObserver = new ResizeObserver(() => getWidth());
    this.resizeObserver.observe(nativeElement);

    this._subscriptions.add(fromEvent(window, 'resize').subscribe(() => getWidth()));

    getWidth();
  }

  private observeMutations(): void {
    const nativeElement = this.elementRef.nativeElement as HTMLElement;

    this.mutationObserver = new MutationObserver(() => {
      if (!this._muuri) return;

      const container = this.elementRef.nativeElement as HTMLElement;
      const items = Array.from(container.children).filter(
        el => !this._muuri!.getItems().some(item => item.getElement() === el)
      ) as HTMLElement[];

      if (items.length > 0) {
        this._muuri.add(items);
      }

      this._mutationTrigger$.next(null);
    });

    this.mutationObserver.observe(nativeElement, {
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
