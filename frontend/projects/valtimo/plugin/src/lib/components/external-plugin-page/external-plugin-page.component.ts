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
import {map, Subscription, switchMap, tap, throwError} from 'rxjs';
import {ExternalPluginIframeComponent} from '../external-plugin-iframe/external-plugin-iframe.component';
import {FitPageDirective} from '@valtimo/components';
import {ExternalPluginPageService, ExternalPluginSessionService} from '../../services';
import {ExternalPluginMenuPage} from '../../models';
import {derivePluginDataUrl} from '../../utils';

type PageState = 'loading' | 'ready' | 'error';

/**
 * Renders an external-plugin `page` bundle as a routed full page. Mirrors the case-tab spine:
 * resolves the page descriptor for the route's `configurationId`/`bundleKey`, starts the
 * downscoped user-token session (mint + re-mint with retry, owned by the page-scoped
 * {@link ExternalPluginSessionService}), derives the plugin data URL, and hosts the shared iframe.
 * The iframe is at an opaque origin and never receives the token (parent-proxy only).
 */
@Component({
  templateUrl: './external-plugin-page.component.html',
  styleUrls: ['./external-plugin-page.component.scss'],
  standalone: true,
  providers: [ExternalPluginSessionService],
  imports: [
    CommonModule,
    LoadingModule,
    TranslateModule,
    ExternalPluginIframeComponent,
    FitPageDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExternalPluginPageComponent implements OnInit, OnDestroy {
  public readonly $state = signal<PageState>('loading');
  public readonly $page = signal<ExternalPluginMenuPage | null>(null);
  public readonly $pluginDataUrl = signal<string | null>(null);
  public readonly $context = signal<Record<string, unknown>>({});
  public readonly $iframeReady = signal<boolean>(false);

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly pageService: ExternalPluginPageService,
    protected readonly sessionService: ExternalPluginSessionService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this.route.params
        .pipe(
          map(params => ({
            configurationId: params['configurationId'] as string,
            bundleKey: (params['bundleKey'] as string) ?? null,
          })),
          // Navigating between two plugin pages reuses this component, so reset to the loading state
          // on every param change. This tears down the previous `ready` view (and its iframe) so the
          // freshly matched page is hosted in a new iframe instead of the reused one keeping its src.
          tap(() => {
            this.$state.set('loading');
            this.$iframeReady.set(false);
          }),
          switchMap(({configurationId, bundleKey}) =>
            this.pageService.getMenuPages().pipe(
              map(pages => this._matchPage(pages, configurationId, bundleKey)),
              switchMap(page =>
                page?.bundleUrl
                  ? this.sessionService.startSession(page.configurationId).pipe(map(() => page))
                  : throwError(() => new Error('plugin-page-unavailable'))
              )
            )
          )
        )
        .subscribe({
          next: page => this.onLoaded(page),
          error: () => this.$state.set('error'),
        })
    );
  }

  public ngOnDestroy(): void {
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

  private onLoaded(page: ExternalPluginMenuPage): void {
    this.$page.set(page);
    this.$context.set({configurationId: page.configurationId});
    this.$pluginDataUrl.set(derivePluginDataUrl(page.bundleUrl));
    this.$state.set('ready');
  }
}
