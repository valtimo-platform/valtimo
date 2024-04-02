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
import {isBoolean} from 'lodash';
import {BehaviorSubject, Observable, of, Subscription} from 'rxjs';
import {filter, switchMap} from 'rxjs/operators';
import {EditorService} from '../components/editor/editor.service';
import {SelectableCarbonTheme, SelectableMonacoTheme} from '../models';

declare const monaco: any;

@Injectable({
  providedIn: 'root',
})
export class CdsThemeService implements OnDestroy {
  private readonly _editorTheme$ = new BehaviorSubject<SelectableMonacoTheme>(
    SelectableMonacoTheme.VS
  );
  private readonly _preferredTheme$ = new BehaviorSubject<SelectableCarbonTheme>(
    SelectableCarbonTheme.G10
  );

  public get preferredTheme$(): Observable<SelectableCarbonTheme> {
    return this._preferredTheme$.pipe(filter(theme => !!theme));
  }

  private readonly _subscriptions = new Subscription();

  constructor(private readonly editorService: EditorService) {
    this.openDarkModeSubscription();
    this.openMonacoThemeSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public setPreferredTheme(selectedTheme: SelectableCarbonTheme): void {
    if (selectedTheme) this._preferredTheme$.next(selectedTheme);
  }

  private openDarkModeSubscription(): void {
    this._subscriptions.add(
      this.preferredTheme$
        .pipe(
          switchMap((preferredTheme: SelectableCarbonTheme) =>
            preferredTheme === SelectableCarbonTheme.SYSTEM
              ? this.getBrowserPrefersDarkModeObservable()
              : of(preferredTheme)
          )
        )
        .subscribe((theme: SelectableCarbonTheme | boolean) => {
          let documentTheme: SelectableCarbonTheme;
          let editorTheme: SelectableMonacoTheme;

          if (isBoolean(theme)) {
            documentTheme = theme ? SelectableCarbonTheme.G90 : SelectableCarbonTheme.G10;
            editorTheme = theme ? SelectableMonacoTheme.VSDARK : SelectableMonacoTheme.VS;
          } else {
            documentTheme = theme;
            editorTheme =
              theme === SelectableCarbonTheme.G10
                ? SelectableMonacoTheme.VS
                : SelectableMonacoTheme.VSDARK;
          }
          this.setThemeOnDocument(documentTheme);
          this._editorTheme$.next(editorTheme);
        })
    );
  }

  private openMonacoThemeSubscription(): void {
    this._subscriptions.add(
      this.editorService.loadingFinished$
        .pipe(switchMap(() => this._editorTheme$))
        .subscribe((theme: SelectableMonacoTheme) => {
          this.setMonacoEditorTheme(theme);
        })
    );
  }

  private setThemeOnDocument(theme: SelectableCarbonTheme): void {
    document.documentElement.setAttribute('data-carbon-theme', theme);
  }

  private setMonacoEditorTheme(monacoTheme: SelectableMonacoTheme): void {
    monaco?.editor?.setTheme(monacoTheme);
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
