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

import {Injectable, OnDestroy, ViewContainerRef} from '@angular/core';
import {BehaviorSubject, combineLatest, Observable, Subscription} from 'rxjs';
import {NavigationEnd, NavigationStart, ResolveEnd, Router} from '@angular/router';
import {filter, tap} from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class PageTitleService implements OnDestroy {
  private readonly _customPageTitle$ = new BehaviorSubject<string>('');
  private readonly _customPageTitleSet$ = new BehaviorSubject<boolean>(false);
  private readonly _customPageSubtitle$ = new BehaviorSubject<string>('');
  private readonly _customPageSubtitleSet$ = new BehaviorSubject<boolean>(false);
  private readonly _hasPageActions$ = new BehaviorSubject<boolean>(false);
  private readonly _pageActionsFullWidth$ = new BehaviorSubject<boolean>(false);

  private readonly _pageActionsViewContainerRef$ = new BehaviorSubject<ViewContainerRef | null>(
    null
  );

  private readonly _pageTitleHidden$ = new BehaviorSubject<boolean>(false);

  private _routeSubscription!: Subscription;

  private _preventReset!: boolean;

  public get customPageTitle$(): Observable<string> {
    return this._customPageTitle$.asObservable();
  }

  public get customPageTitleSet$(): Observable<boolean> {
    return this._customPageTitleSet$.asObservable();
  }

  public get customPageSubtitle$(): Observable<string> {
    return this._customPageSubtitle$.asObservable();
  }

  public get customPageSubtitleSet$(): Observable<boolean> {
    return this._customPageSubtitleSet$.asObservable();
  }

  public get pageActionsViewContainerRef$(): Observable<ViewContainerRef> {
    return this._pageActionsViewContainerRef$.pipe(filter(ref => !!ref));
  }

  public get hasPageActions$(): Observable<boolean> {
    return this._hasPageActions$.asObservable();
  }

  public get pageActionsFullWidth$(): Observable<boolean> {
    return this._pageActionsFullWidth$.asObservable();
  }

  public get pageTitleHidden$(): Observable<boolean> {
    return this._pageTitleHidden$.asObservable();
  }

  constructor(private readonly router: Router) {
    this.openRouteSubscription();
  }

  public ngOnDestroy(): void {
    this._routeSubscription?.unsubscribe();
  }

  public setCustomPageTitle(title: string, preventReset = false): void {
    this._customPageTitle$.next(title);
    this._customPageTitleSet$.next(true);

    if (preventReset) {
      this.disableReset();
    }
  }

  public setCustomPageSubtitle(title: string): void {
    this._customPageSubtitle$.next(title);
    this._customPageSubtitleSet$.next(true);
  }

  public disableReset(): void {
    this._preventReset = true;
  }

  public enableReset(): void {
    this._preventReset = false;
  }

  public setPageActionsViewContainerRef(ref: ViewContainerRef): void {
    this._pageActionsViewContainerRef$.next(ref);
  }

  public setHasPageActions(value: boolean): void {
    this._hasPageActions$.next(value);
  }

  public setPageActionsFullWidth(value: boolean): void {
    this._pageActionsFullWidth$.next(value);
  }

  public setCustomPageTitleSet(set: boolean): void {
    this._customPageTitleSet$.next(set);
  }

  public setPageTitleHidden(hidden: boolean): void {
    this._pageTitleHidden$.next(hidden);
  }

  private openRouteSubscription(): void {
    this._routeSubscription = combineLatest([this.router.events, this.pageActionsViewContainerRef$])
      .pipe(
        filter(
          ([event]) =>
            event instanceof NavigationEnd ||
            event instanceof NavigationStart ||
            event instanceof ResolveEnd
        ),
        tap(([_, pageActionsViewContainerRef]) => {
          if (!this._preventReset) {
            this._customPageTitle$.next('');
            this._customPageTitleSet$.next(false);
            this._customPageSubtitle$.next('');
            this._customPageSubtitleSet$.next(false);
          }

          if (pageActionsViewContainerRef && !this._preventReset) {
            pageActionsViewContainerRef.clear();
            this.setHasPageActions(false);
          }
        })
      )
      .subscribe();
  }
}
