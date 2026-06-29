/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, OnDestroy, OnInit, signal} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {LoadingModule} from 'carbon-components-angular';
import {map, Subscription, switchMap, throwError} from 'rxjs';
import {ExternalPluginIframeComponent} from '../external-plugin-iframe/external-plugin-iframe.component';
import {ExternalPluginPageService} from '../../services';
import {ExternalPluginMenuPage, ExternalPluginUserTokenResponse} from '../../models';

type PageState = 'loading' | 'ready' | 'error';

/**
 * Renders an external-plugin `page` bundle as a routed full page. Mirrors the case-tab spine:
 * resolves the page descriptor for the route's `configurationId`/`bundleKey`, mints a downscoped
 * user token (with a re-mint timer), derives the plugin data URL, and hosts the shared iframe. The
 * iframe is at an opaque origin and never receives the token (parent-proxy only).
 */
@Component({
  templateUrl: './external-plugin-page.component.html',
  styleUrls: ['./external-plugin-page.component.scss'],
  standalone: true,
  imports: [CommonModule, LoadingModule, TranslateModule, ExternalPluginIframeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExternalPluginPageComponent implements OnInit, OnDestroy {
  public readonly $state = signal<PageState>('loading');
  public readonly $page = signal<ExternalPluginMenuPage | null>(null);
  public readonly $userToken = signal<string | null>(null);
  public readonly $pluginDataUrl = signal<string | null>(null);
  public readonly $context = signal<Record<string, unknown>>({});
  public readonly $iframeReady = signal<boolean>(false);

  private readonly _subscriptions = new Subscription();
  private _reMintHandle: number | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly pageService: ExternalPluginPageService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this.route.params
        .pipe(
          map(params => ({
            configurationId: params['configurationId'] as string,
            bundleKey: (params['bundleKey'] as string) ?? null,
          })),
          switchMap(({configurationId, bundleKey}) =>
            this.pageService.getMenuPages().pipe(
              map(pages => this._matchPage(pages, configurationId, bundleKey)),
              switchMap(page =>
                page?.bundleUrl
                  ? this.pageService
                      .mintUserToken(page.configurationId)
                      .pipe(map(token => ({page, token})))
                  : throwError(() => new Error('plugin-page-unavailable'))
              )
            )
          )
        )
        .subscribe({
          next: ({page, token}) => this.onLoaded(page, token),
          error: () => this.$state.set('error'),
        })
    );
  }

  public ngOnDestroy(): void {
    this._clearReMint();
    this._subscriptions.unsubscribe();
  }

  public onIframeReady(): void {
    this.$iframeReady.set(true);
  }

  private _matchPage(
    pages: Array<ExternalPluginMenuPage>,
    configurationId: string,
    bundleKey: string | null
  ): ExternalPluginMenuPage | null {
    const forConfiguration = pages.filter(page => page.configurationId === configurationId);
    if (bundleKey) {
      return forConfiguration.find(page => page.bundleKey === bundleKey) ?? null;
    }
    return forConfiguration[0] ?? null;
  }

  private onLoaded(page: ExternalPluginMenuPage, token: ExternalPluginUserTokenResponse): void {
    this.$page.set(page);
    this.$context.set({configurationId: page.configurationId});
    this.$userToken.set(token.userToken);
    this.$pluginDataUrl.set(this._derivePluginDataUrl(page.bundleUrl));
    this.$state.set('ready');
    this._scheduleReMint(page.configurationId, token.expiresAt);
  }

  /**
   * Derives the plugin host data route (`{base}/data`) from the bundle URL
   * (`{base}/bundles/page.html`). Returns null when the URL doesn't follow the bundle layout.
   */
  private _derivePluginDataUrl(bundleUrl: string | null): string | null {
    if (!bundleUrl) return null;
    const idx = bundleUrl.indexOf('/bundles/');
    return idx >= 0 ? `${bundleUrl.substring(0, idx)}/data` : null;
  }

  /**
   * Re-mints the downscoped user token shortly before its (≤15-min) expiry and pushes the fresh
   * token into the iframe component input. Purely a parent-side concern — the iframe holds no token.
   */
  private _scheduleReMint(configurationId: string, expiresAt: string): void {
    this._clearReMint();
    const expiry = new Date(expiresAt).getTime();
    const delay = Math.max(expiry - Date.now() - 60_000, 30_000);
    this._reMintHandle = window.setTimeout(() => {
      this._subscriptions.add(
        this.pageService.mintUserToken(configurationId).subscribe(token => {
          this.$userToken.set(token.userToken);
          this._scheduleReMint(configurationId, token.expiresAt);
        })
      );
    }, delay);
  }

  private _clearReMint(): void {
    if (this._reMintHandle !== null) {
      window.clearTimeout(this._reMintHandle);
      this._reMintHandle = null;
    }
  }
}
