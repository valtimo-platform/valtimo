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
