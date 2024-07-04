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

import {Injectable, OnDestroy, Renderer2, RendererFactory2} from '@angular/core';
import {
  BehaviorSubject,
  combineLatest,
  fromEvent,
  map,
  Observable,
  Subject,
  Subscription,
} from 'rxjs';
import {debounceTime, take} from 'rxjs/operators';
import {ConfigService, ValtimoConfig} from '@valtimo/config';

@Injectable({
  providedIn: 'root',
})
export class ShellService implements OnDestroy {
  private renderer!: Renderer2;
  private readonly _sideBarExpanded$ = new BehaviorSubject<boolean>(true);
  private readonly _panelExpanded$ = new BehaviorSubject<boolean>(false);
  private readonly _largeScreen$ = new BehaviorSubject<boolean>(true);
  private readonly _mouseOnTopBar$ = new BehaviorSubject<boolean>(false);
  private readonly _sidenavWidth$ = new BehaviorSubject<number>(300);
  private readonly _sidenavElement$ = new BehaviorSubject<HTMLElement>(undefined);
  private readonly _contentElement$ = new BehaviorSubject<HTMLElement>(undefined);
  private readonly _resizeBorderElement$ = new BehaviorSubject<HTMLElement>(undefined);
  private readonly _mouseX$ = fromEvent(document.body, 'mousemove').pipe(
    map((e: MouseEvent) => e.pageX)
  );
  private readonly _isResizing$ = new BehaviorSubject<boolean>(false);
  private readonly _collapsibleWidescreenMenu$ = new BehaviorSubject<boolean>(false);
  private readonly _mainContentResized$ = new Subject<null>();
  private sidenavWidthOnClick!: number;
  private xOnClick!: number;
  private sidenavSizeSubscription!: Subscription;
  private mouseXSubscription!: Subscription;
  private mouseUpSubscription!: Subscription;
  private maxMenuWidth!: number;
  private minMenuWidth!: number;

  get sideBarExpanded$(): Observable<boolean> {
    return this._sideBarExpanded$.asObservable();
  }
  get panelExpanded$(): Observable<boolean> {
    return this._panelExpanded$.asObservable();
  }
  get largeScreen$(): Observable<boolean> {
    return this._largeScreen$.asObservable();
  }
  get mouseOnTopBar$(): Observable<boolean> {
    return this._mouseOnTopBar$.asObservable();
  }

  get sidenavWidth$(): Observable<number> {
    return this._sidenavWidth$.asObservable();
  }

  get collapsibleWidescreenMenu$(): Observable<boolean> {
    return this._collapsibleWidescreenMenu$.asObservable();
  }

  get mainContentResized$(): Observable<null> {
    return this._mainContentResized$.asObservable();
  }

  constructor(
    private readonly rendererFactory2: RendererFactory2,
    private readonly configService: ConfigService
  ) {
    this.renderer = rendererFactory2.createRenderer(null, null);
    this.openSidenavSizeSubscription();
    this.openMouseSubscriptions();
    this.initMenuWidth(configService.config);
  }

  ngOnDestroy(): void {
    this.sidenavSizeSubscription.unsubscribe();
  }

  toggleSideBar(): void {
    const isExpanded = this._sideBarExpanded$.getValue();
    this._sideBarExpanded$.next(!isExpanded);
  }

  collapseSideBar(): void {
    this._sideBarExpanded$.next(false);
  }

  togglePanel(): void {
    const isExpanded = this._panelExpanded$.getValue();
    this._panelExpanded$.next(!isExpanded);
  }

  setPanelExpanded(isExpanded: boolean): void {
    this._panelExpanded$.next(isExpanded);
  }

  setSideBarExpanded(isExpanded: boolean): void {
    this._sideBarExpanded$.next(isExpanded);
  }

  setLargeScreen(isLarge: boolean): void {
    this._largeScreen$.next(isLarge);
  }

  setMouseOnTopBar(mouseOnTopBar: boolean): void {
    this._mouseOnTopBar$.next(mouseOnTopBar);
  }

  setSidenavElement(element: HTMLElement): void {
    this._sidenavElement$.next(element);
    this.createResizeBorderElement(element);
  }

  setContentElement(element: HTMLElement): void {
    this._contentElement$.next(element);
  }

  setCollapsibleWidescreenMenu(collapsible: boolean) {
    this._collapsibleWidescreenMenu$.next(collapsible);

    if (collapsible) {
      this.collapseSideBar();
    }
  }

  onMainContentResize(): void {
    this._mainContentResized$.next(null);
  }

  private createResizeBorderElement(sidenavElement: HTMLElement): void {
    const borderElement = this.renderer.createElement('div');
    this.renderer.addClass(borderElement, 'resize-border');
    this.renderer.appendChild(sidenavElement, borderElement);
    this._resizeBorderElement$.next(borderElement);

    this.renderer.listen(borderElement, 'mouseenter', () => {
      this.renderer.addClass(borderElement, 'resize-hover');
    });

    this.renderer.listen(borderElement, 'mouseleave', () => {
      this._isResizing$.pipe(take(1)).subscribe(isResizing => {
        if (!isResizing) {
          this.renderer.removeClass(borderElement, 'resize-hover');
        }
      });
    });

    this.renderer.listen(borderElement, 'mousedown', (event: MouseEvent) => {
      this._sidenavWidth$.pipe(take(1)).subscribe(sidenavWidth => {
        this.sidenavWidthOnClick = sidenavWidth;
        this.xOnClick = event.pageX;
        this._isResizing$.next(true);
        this.renderer.setStyle(document.body, 'user-select', 'none');
        this.renderer.setStyle(document.body, 'cursor', 'col-resize');
        this.renderer.setStyle(
          document.querySelector('.cds--side-nav__navigation'),
          'pointer-events',
          'none'
        );
        this.renderer.setStyle(document.querySelector('.main-content'), 'pointer-events', 'none');
      });
    });
  }

  private openSidenavSizeSubscription(): void {
    this.sidenavSizeSubscription = combineLatest([
      this._largeScreen$,
      this._sidenavWidth$,
      this._sidenavElement$,
      this._contentElement$,
      this._resizeBorderElement$,
      this._collapsibleWidescreenMenu$,
    ]).subscribe(
      ([
        largeScreen,
        sidenavWidth,
        sidenavElement,
        contentElement,
        resizeBorderElement,
        collapsibleWidescreenMenu,
      ]) => {
        if (
          (!largeScreen || collapsibleWidescreenMenu) &&
          sidenavElement &&
          contentElement &&
          resizeBorderElement
        ) {
          this.renderer.removeStyle(sidenavElement, 'min-width');
          this.renderer.removeStyle(sidenavElement, 'width');
          this.renderer.removeStyle(sidenavElement, 'transition');
          this.renderer.removeStyle(contentElement, 'padding-left');
          this.renderer.addClass(resizeBorderElement, 'resize-border--invisible');
        } else if (
          largeScreen &&
          sidenavElement &&
          contentElement &&
          typeof sidenavWidth === 'number'
        ) {
          const pixelWidth = `${sidenavWidth}px`;
          this.renderer.setStyle(sidenavElement, 'min-width', `${pixelWidth}`);
          this.renderer.setStyle(sidenavElement, 'width', `${pixelWidth}`);
          this.renderer.setStyle(sidenavElement, 'transition', 'none');
          this.renderer.setStyle(contentElement, 'padding-left', `calc(2rem + ${pixelWidth})`);
          this.renderer.removeClass(resizeBorderElement, 'resize-border--invisible');
        }
      }
    );
  }

  private openMouseSubscriptions(): void {
    this.mouseXSubscription = combineLatest([this._mouseX$, this._isResizing$])
      .pipe(debounceTime(3))
      .subscribe(([x, isResizing]) => {
        if (isResizing) {
          const offSetWidth = this.xOnClick - x;
          const newSidenavWidth = this.sidenavWidthOnClick - offSetWidth;

          if (newSidenavWidth <= this.maxMenuWidth && newSidenavWidth >= this.minMenuWidth) {
            this._sidenavWidth$.next(newSidenavWidth);
          }
        }
      });

    this.mouseUpSubscription = fromEvent(document, 'mouseup').subscribe(() => {
      this.stopResizing();
    });
  }

  private stopResizing(): void {
    const mainContent = document.querySelector('.main-content');
    const sideNav = document.querySelector('.cds--side-nav__navigation');

    this.renderer.removeStyle(document.body, 'user-select');
    this.renderer.removeStyle(document.body, 'cursor');
    this._isResizing$.next(false);
    this.renderer.removeClass(this._resizeBorderElement$.getValue(), 'resize-hover');

    if (sideNav) {
      this.renderer.removeStyle(sideNav, 'pointer-events');
    }

    if (mainContent) {
      this.renderer.removeStyle(mainContent, 'pointer-events');
    }
    localStorage.setItem('sidenavWidth', this._sidenavWidth$.getValue().toString());
  }

  private initMenuWidth(config: ValtimoConfig): void {
    const customLeftSidebar = config?.customLeftSidebar;
    const localStorageWidth = localStorage.getItem('sidenavWidth');
    const localStorageWidthNumber = localStorageWidth && +localStorageWidth;
    const configWidth = customLeftSidebar?.defaultMenuWidth;

    this._sidenavWidth$.next(localStorageWidthNumber || configWidth || 256);
    this.minMenuWidth = customLeftSidebar?.minMenuWidth || 150;
    this.maxMenuWidth = customLeftSidebar?.maxMenuWidth || 500;
  }
}
