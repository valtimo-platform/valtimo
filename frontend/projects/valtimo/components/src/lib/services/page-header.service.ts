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

import {Injectable, ViewContainerRef} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {filter} from 'rxjs/operators';
import {ConfigService} from '@valtimo/config';

@Injectable({
  providedIn: 'root',
})
export class PageHeaderService {
  private readonly _headerViewContainerRef$ = new BehaviorSubject<ViewContainerRef | null>(null);
  private readonly _contentViewContainerRef$ = new BehaviorSubject<ViewContainerRef | null>(null);
  private readonly _compactMode$ = new BehaviorSubject<boolean>(
    !!this.configService?.config?.featureToggles?.compactModeOnByDefault
  );
  private readonly _showUserNameInTopBar$ = new BehaviorSubject<boolean>(
    this.getDefaultShowUserNameInTopBarValue()
  );
  private readonly _pageActionsHasContent$ = new BehaviorSubject<boolean>(false);
  private readonly _pageHeadHeight$ = new BehaviorSubject<number | null>(null);

  public get headerViewContainerRef$(): Observable<ViewContainerRef> {
    return this._headerViewContainerRef$.pipe(filter(ref => !!ref));
  }

  public get contentViewContainerRef$(): Observable<ViewContainerRef> {
    return this._contentViewContainerRef$.pipe(filter(ref => !!ref));
  }

  public get compactMode$(): Observable<boolean> {
    return this._compactMode$.asObservable();
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

  constructor(private readonly configService: ConfigService) {}

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

  private getDefaultShowUserNameInTopBarValue(): boolean {
    const featureToggles = this.configService?.config?.featureToggles;

    if (featureToggles && featureToggles.hasOwnProperty('showUserNameInTopBar')) {
      return featureToggles.showUserNameInTopBar;
    }

    return true;
  }
}
