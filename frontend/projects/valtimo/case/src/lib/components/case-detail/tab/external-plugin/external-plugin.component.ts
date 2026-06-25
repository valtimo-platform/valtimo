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
import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {ExternalPluginIframeComponent} from '@valtimo/plugin';
import {LoadingModule} from 'carbon-components-angular';
import {combineLatest, filter, map, Observable, Subscription, switchMap, throwError} from 'rxjs';
import {CaseExternalPluginTabApiService, CaseTabService} from '../../../../services';
import {ExternalPluginTabContent, ExternalPluginUserTokenResponse} from '../../../../models';

type TabState = 'loading' | 'ready' | 'error';

@Component({
  templateUrl: './external-plugin.component.html',
  styleUrls: ['./external-plugin.component.scss'],
  standalone: true,
  imports: [CommonModule, LoadingModule, TranslateModule, ExternalPluginIframeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseDetailExternalPluginTabComponent implements OnInit, OnDestroy {
  @HostBinding('class.tab--no-margin') private readonly _noMargin = true;
  @HostBinding('class.tab--no-background') private readonly _noBackground = true;
  @HostBinding('class.tab--no-min-height') private readonly _noMinHeight = true;

  public readonly $state = signal<TabState>('loading');
  public readonly $content = signal<ExternalPluginTabContent | null>(null);
  public readonly $userToken = signal<string | null>(null);
  public readonly $pluginDataUrl = signal<string | null>(null);
  public readonly $iframeReady = signal<boolean>(false);

  private readonly _documentId$: Observable<string> = this.route.params.pipe(
    map(params => params?.documentId),
    filter(documentId => !!documentId)
  );
  private readonly _tabKey$: Observable<string> = this.caseTabService.activeTabKey$;

  private readonly _subscriptions = new Subscription();
  private _reMintHandle: number | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly caseTabService: CaseTabService,
    private readonly apiService: CaseExternalPluginTabApiService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      combineLatest([this._documentId$, this._tabKey$])
        .pipe(
          switchMap(([documentId, tabKey]) =>
            this.apiService
              .getExternalPluginTab(documentId, tabKey)
              .pipe(
                switchMap(content =>
                  content?.bundleUrl
                    ? this.apiService
                        .mintUserToken(content.configurationId)
                        .pipe(map(token => ({content, token})))
                    : throwError(() => new Error('bundle-unavailable'))
                )
              )
          )
        )
        .subscribe({
          next: ({content, token}) => this.onLoaded(content, token),
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

  private onLoaded(
    content: ExternalPluginTabContent,
    token: ExternalPluginUserTokenResponse
  ): void {
    this.$content.set(content);
    this.$userToken.set(token.userToken);
    this.$pluginDataUrl.set(this._derivePluginDataUrl(content.bundleUrl));
    this.$state.set('ready');
    this._scheduleReMint(content.configurationId, token.expiresAt);
  }

  /**
   * Derives the plugin host data route (`{base}/data`) from the bundle URL
   * (`{base}/bundles/case-tab.html`). Returns null when the URL doesn't follow the bundle layout.
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
        this.apiService.mintUserToken(configurationId).subscribe(token => {
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
