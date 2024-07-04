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
import {Injectable, OnDestroy} from '@angular/core';
import {BehaviorSubject, combineLatest, Observable, Subscription} from 'rxjs';
import {filter} from 'rxjs/operators';
import {CurrentCarbonTheme, SelectableCarbonTheme} from '../models';

@Injectable({
  providedIn: 'root',
})
export class CdsThemeService implements OnDestroy {
  private readonly _preferredTheme$ = new BehaviorSubject<SelectableCarbonTheme>(
    SelectableCarbonTheme.G10
  );
  private readonly _currentTheme$ = new BehaviorSubject<CurrentCarbonTheme | null>(null);

  public get preferredTheme$(): Observable<SelectableCarbonTheme> {
    return this._preferredTheme$.pipe(filter(theme => !!theme));
  }

  public get currentTheme$(): Observable<CurrentCarbonTheme> {
    return this._currentTheme$.pipe(filter(theme => !!theme));
  }

  private readonly _subscriptions = new Subscription();

  constructor() {
    this.openDarkModeSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public setPreferredTheme(selectedTheme: SelectableCarbonTheme): void {
    if (selectedTheme) this._preferredTheme$.next(selectedTheme);
  }

  private openDarkModeSubscription(): void {
    combineLatest([this.getBrowserPrefersDarkModeObservable(), this.preferredTheme$]).subscribe(
      ([browserPrefersDarkMode, preferredTheme]) => {
        switch (preferredTheme) {
          case SelectableCarbonTheme.SYSTEM:
            if (browserPrefersDarkMode) {
              this.setThemeOnDocument(CurrentCarbonTheme.G90);
            } else {
              this.setThemeOnDocument(CurrentCarbonTheme.G10);
            }
            break;
          case SelectableCarbonTheme.G10:
            this.setThemeOnDocument(CurrentCarbonTheme.G10);
            break;
          case SelectableCarbonTheme.G90:
            this.setThemeOnDocument(CurrentCarbonTheme.G90);
            break;
        }
      }
    );
  }

  private setThemeOnDocument(theme: CurrentCarbonTheme): void {
    document.documentElement.setAttribute('data-carbon-theme', theme);
    this._currentTheme$.next(theme);
  }

  private getBrowserPrefersDarkModeObservable(signal?: AbortSignal): Observable<boolean> {
    return new Observable<boolean>(subscriber => {
      if (!window.matchMedia) {
        subscriber.error(new Error('No windows Media Match available'));
      }

      function emitValue(event: Event) {
        subscriber.next((event as MediaQueryListEvent).matches);
      }

      const mediaListQuery = window.matchMedia('(prefers-color-scheme: dark)');

      if (signal) {
        signal.onabort = () => {
          mediaListQuery.removeEventListener('change', emitValue);
          !subscriber.closed && subscriber.complete();
        };
      }

      mediaListQuery.addEventListener('change', emitValue);
      subscriber.next(mediaListQuery.matches);

      return () => {
        mediaListQuery.removeEventListener('change', emitValue);
        !subscriber.closed && subscriber.complete();
      };
    });
  }
}
