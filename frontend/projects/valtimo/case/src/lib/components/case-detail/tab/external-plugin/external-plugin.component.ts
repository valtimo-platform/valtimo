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
import {
  derivePluginDataUrl,
  ExternalPluginIframeComponent,
  ExternalPluginSessionService,
} from '@valtimo/plugin';
import {FitPageDirective} from '@valtimo/components';
import {LoadingModule} from 'carbon-components-angular';
import {combineLatest, filter, map, Observable, Subscription, switchMap, throwError} from 'rxjs';
import {CaseExternalPluginTabApiService, CaseTabService} from '../../../../services';
import {ExternalPluginTabContent, ExternalPluginTabState} from '../../../../models';

@Component({
  templateUrl: './external-plugin.component.html',
  styleUrls: ['./external-plugin.component.scss'],
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
export class CaseDetailExternalPluginTabComponent implements OnInit, OnDestroy {
  @HostBinding('class.tab--no-margin') private readonly _noMargin = true;
  @HostBinding('class.tab--no-background') private readonly _noBackground = true;
  @HostBinding('class.tab--no-min-height') private readonly _noMinHeight = true;
  // Carries the external-plugin-specific height/overflow overrides in case-detail.component.scss,
  // so they no longer leak onto other tabs that use .tab--no-min-height (widgets, documents).
  @HostBinding('class.tab--external-plugin') private readonly _externalPlugin = true;

  public readonly $state = signal<ExternalPluginTabState>('loading');
  public readonly $content = signal<ExternalPluginTabContent | null>(null);
  public readonly $pluginDataUrl = signal<string | null>(null);
  public readonly $iframeReady = signal<boolean>(false);

  private readonly _documentId$: Observable<string> = this.route.params.pipe(
    map(params => params?.documentId),
    filter(documentId => !!documentId)
  );
  private readonly _tabKey$: Observable<string> = this.caseTabService.activeTabKey$;

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly caseTabService: CaseTabService,
    private readonly apiService: CaseExternalPluginTabApiService,
    protected readonly sessionService: ExternalPluginSessionService
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
                    ? this.sessionService
                        .startSession(content.configurationId)
                        .pipe(map(() => content))
                    : throwError(() => new Error('bundle-unavailable'))
                )
              )
          )
        )
        .subscribe({
          next: content => this.onLoaded(content),
          error: () => this.$state.set('error'),
        })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onIframeReady(): void {
    this.$iframeReady.set(true);
    // Force fitPage recalculation after CSS :has() selectors have settled
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
  }

  private onLoaded(content: ExternalPluginTabContent): void {
    this.$content.set(content);
    this.$pluginDataUrl.set(derivePluginDataUrl(content.bundleUrl));
    this.$state.set('ready');
    // Trigger fitPage recalculation after the iframe element is rendered
    setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
  }
}
