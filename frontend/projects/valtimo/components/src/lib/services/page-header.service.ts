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

import {Injectable, ViewContainerRef} from '@angular/core';
import {BehaviorSubject, Observable, Subscription} from 'rxjs';
import {filter} from 'rxjs/operators';
import {ConfigService} from '@valtimo/shared';

@Injectable({
  providedIn: 'root',
})
export class PageHeaderService {
  private readonly _headerViewContainerRef$ = new BehaviorSubject<ViewContainerRef | null>(null);
  private readonly _contentViewContainerRef$ = new BehaviorSubject<ViewContainerRef | null>(null);
  private readonly _compactMode$ = new BehaviorSubject<boolean>(false);
  private readonly _showUserNameInTopBar$ = new BehaviorSubject<boolean>(true);
  private readonly _pageActionsHasContent$ = new BehaviorSubject<boolean>(false);
  private readonly _pageHeadHeight$ = new BehaviorSubject<number | null>(null);

  private readonly _smallTitle$ = new BehaviorSubject<boolean>(false);
  private readonly _titleAsBreadcrumb$ = new BehaviorSubject<boolean>(false);

  private readonly _featureToggleSub: Subscription;

  public get headerViewContainerRef$(): Observable<ViewContainerRef> {
    return this._headerViewContainerRef$.pipe(filter(ref => !!ref));
  }

  public get contentViewContainerRef$(): Observable<ViewContainerRef> {
    return this._contentViewContainerRef$.pipe(filter(ref => !!ref));
  }

  public get compactMode$(): Observable<boolean> {
    return this._compactMode$.asObservable();
  }

  public get smallTitle$(): Observable<boolean> {
    return this._smallTitle$.asObservable();
  }

  public get titleAsBreadcrumb$(): Observable<boolean> {
    return this._titleAsBreadcrumb$.asObservable();
  }

  public get showUserNameInTopBar$(): Observable<boolean> {
    return this._showUserNameInTopBar$.asObservable();
  }

  public get pageActionsHasContent$(): Observable<boolean> {
    return this._pageActionsHasContent$.asObservable();
  }

  public get pageHeadHeight$(): Observable<number> {
    return this._pageHeadHeight$.pipe(filter(height => height !== null));
  }

  constructor(private readonly configService: ConfigService) {
    this._featureToggleSub = this.configService.featureToggles$.subscribe(toggles => {
      if (toggles?.hasOwnProperty('compactModeOnByDefault')) {
        this._compactMode$.next(!!toggles.compactModeOnByDefault);
      }

      if (toggles?.hasOwnProperty('showUserNameInTopBar')) {
        this._showUserNameInTopBar$.next(!!toggles.showUserNameInTopBar);
      } else {
        this._showUserNameInTopBar$.next(true);
      }
    });
  }

  public setHeaderViewContainerRef(ref: ViewContainerRef): void {
    this._headerViewContainerRef$.next(ref);
  }

  public setContentViewContainerRef(ref: ViewContainerRef): void {
    this._contentViewContainerRef$.next(ref);
  }

  public setCompactMode(compactMode: boolean): void {
    this._compactMode$.next(compactMode);
  }

  public setShowUserNameInTopBar(show: boolean): void {
    this._showUserNameInTopBar$.next(show);
  }

  public setPageActionsHasContent(hasContent: boolean): void {
    this._pageActionsHasContent$.next(hasContent);
  }

  public setPageHeadHeight(height: number): void {
    this._pageHeadHeight$.next(height);
  }

  public enableSmallTitle(): void {
    this._smallTitle$.next(true);
  }

  public disableSmallTitle(): void {
    this._smallTitle$.next(false);
  }

  /**
   * Renders the current page title inline as the final (non-link) breadcrumb item instead of
   * as a large heading below the breadcrumb trail, freeing up the page header row for actions.
   * Unlike compact mode, the breadcrumb stays in the page header area (not the top bar).
   *
   * Enable from a component's `ngAfterViewInit`/`ngOnInit` and disable in `ngOnDestroy`.
   */
  public enableTitleAsBreadcrumb(): void {
    this._titleAsBreadcrumb$.next(true);
  }

  public disableTitleAsBreadcrumb(): void {
    this._titleAsBreadcrumb$.next(false);
  }
}
