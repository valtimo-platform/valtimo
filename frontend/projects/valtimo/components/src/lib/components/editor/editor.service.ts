/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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

import {Injectable} from '@angular/core';
import {Subject} from 'rxjs';
import {WindowWithMonaco} from '../../models';

@Injectable({
  providedIn: 'root',
})
export class EditorService {
  public loadingFinished$ = new Subject<null>();

  private _loaded = false;

  get loaded(): boolean {
    return this._loaded;
  }

  public load(): void {
    const baseUrl = './assets' + '/monaco-editor/min/vs';

    if (typeof (window as WindowWithMonaco).monaco === 'object') {
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
}
