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
import {ActivatedRoute, Router} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {LoadingModule} from 'carbon-components-angular';
import {map, Subscription, switchMap, take, tap, throwError} from 'rxjs';
import {ExternalPluginIframeComponent} from '../external-plugin-iframe/external-plugin-iframe.component';
import {FitPageDirective, MenuService, PageTitleService} from '@valtimo/components';
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
  private _titleSubscription?: Subscription;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly menuService: MenuService,
    private readonly pageTitleService: PageTitleService,
    private readonly translateService: TranslateService,
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
          error: () => {
            this.$state.set('error');
            this.setPageTitle(null);
          },
        })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this._titleSubscription?.unsubscribe();
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

  private setPageTitle(page: ExternalPluginMenuPage | null): void {
    // Set even when empty — customPageTitle shows a skeleton until set
    this.pageTitleService.setCustomPageTitle(page?.configurationTitle ?? '');

    this._titleSubscription?.unsubscribe();
    this._titleSubscription = this.menuService
      .getMenuItemTitleForUrl(this.router.url)
      .pipe(take(1))
      .subscribe(menuTitle => {
        if (menuTitle) {
          this.pageTitleService.setCustomPageTitle(this.translateService.instant(menuTitle));
        }
      });
  }

  private onLoaded(page: ExternalPluginMenuPage): void {
    this.setPageTitle(page);
    this.$page.set(page);
    this.$context.set({configurationId: page.configurationId});
    this.$pluginDataUrl.set(derivePluginDataUrl(page.bundleUrl));
    this.$state.set('ready');
  }
}
