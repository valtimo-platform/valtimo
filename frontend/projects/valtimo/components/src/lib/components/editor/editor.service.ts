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

    if (typeof (<WindowWithMonaco>window).monaco === 'object') {
      this.finishLoading();
      return;
    }

    const onGotAmdLoader = () => {
      (<any>window).require.config({paths: {vs: `${baseUrl}`}});
      (<any>window).require([`vs/editor/editor.main`], () => {
        this.finishLoading();
      });
    };

    if (!(<any>window).require) {
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
