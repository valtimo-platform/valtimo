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

import {Inject, Injectable, OnDestroy} from '@angular/core';
import {combineLatest, filter, map, Subject, Subscription} from 'rxjs';
import {CurrentCarbonTheme, MonacoTheme} from '../../models';
import {DOCUMENT} from '@angular/common';
import {CdsThemeService} from '../../services';
import {ValtimoWindow} from '@valtimo/config';

@Injectable({
  providedIn: 'root',
})
export class EditorService implements OnDestroy {
  public readonly loadingFinished$ = new Subject<null>();

  public readonly monacoEditor$ = this.loadingFinished$.pipe(
    map(() => (this.document.defaultView as ValtimoWindow)?.monaco?.editor),
    filter(editor => !!editor)
  );

  private _loaded = false;

  get loaded(): boolean {
    return this._loaded;
  }

  private readonly _subscriptions = new Subscription();

  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    private readonly cdsThemeService: CdsThemeService
  ) {
    this.openThemeSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public load(): void {
    const baseUrl = './assets' + '/monaco-editor/min/vs';

    if (typeof (window as ValtimoWindow).monaco === 'object') {
      this.finishLoading();
      return;
    }

    const onGotAmdLoader = () => {
      (window as any).require.config({paths: {vs: `${baseUrl}`}});
      (window as any).require([`vs/editor/editor.main`], () => {
        this.finishLoading();
      });
    };

    if (!(window as any).require) {
      const loaderScript: HTMLScriptElement = document.createElement('script');
      loaderScript.type = 'text/javascript';
      loaderScript.src = `${baseUrl}/loader.js`;
      loaderScript.addEventListener('load', onGotAmdLoader);
      document.body.appendChild(loaderScript);
    } else {
      onGotAmdLoader();
    }
  }

  private finishLoading(): void {
    this._loaded = true;
    this.loadingFinished$.next(null);
  }

  private openThemeSubscription(): void {
    this._subscriptions.add(
      combineLatest([this.monacoEditor$, this.cdsThemeService.currentTheme$]).subscribe(
        ([editor, currentTheme]) => {
          if (currentTheme === CurrentCarbonTheme.G10) {
            editor.setTheme(MonacoTheme.VS);
          } else {
            editor.setTheme(MonacoTheme.VSDARK);
          }
        }
      )
    );
  }
}
