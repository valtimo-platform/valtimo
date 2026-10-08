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
  forwardRef,
  Input,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {LoadingModule} from 'carbon-components-angular';
import {map, Subscription, switchMap} from 'rxjs';
import {ExternalPluginSidePanel} from '../../models';
import {ExternalPluginSessionService, ExternalPluginSidePanelService} from '../../services';
import {derivePluginDataUrl} from '../../utils';
import {ExternalPluginIframeComponent} from '../external-plugin-iframe/external-plugin-iframe.component';

type SidePanelState = 'loading' | 'ready' | 'error';

/**
 * Side-panel content for an external-plugin `side-panel` bundle. Owns its own user-token session,
 * so the token lives exactly as long as the panel content.
 */
@Component({
  standalone: true,
  selector: 'valtimo-external-plugin-side-panel',
  templateUrl: './external-plugin-side-panel.component.html',
  styleUrls: ['./external-plugin-side-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExternalPluginSessionService],
  // forwardRef: the iframe component offers this component, so the two files import each other.
  imports: [
    CommonModule,
    LoadingModule,
    TranslateModule,
    forwardRef(() => ExternalPluginIframeComponent),
  ],
})
export class ExternalPluginSidePanelComponent implements OnInit, OnDestroy {
  @Input() public bundleKey: string | null = null;
  @Input() public configurationId!: string;
  @Input() public context: Record<string, unknown> = {};

  public readonly $iframeReady = signal<boolean>(false);
  public readonly $panel = signal<ExternalPluginSidePanel | null>(null);
  public readonly $pluginDataUrl = signal<string | null>(null);
  public readonly $state = signal<SidePanelState>('loading');

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly sidePanelApiService: ExternalPluginSidePanelService,
    protected readonly sessionService: ExternalPluginSessionService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this.sidePanelApiService
        .getSidePanel(this.configurationId, this.bundleKey)
        .pipe(
          switchMap(panel =>
            this.sessionService.startSession(panel.configurationId).pipe(map(() => panel))
          )
        )
        .subscribe({
          next: panel => {
            this.$panel.set(panel);
            this.$pluginDataUrl.set(derivePluginDataUrl(panel.bundleUrl));
            this.$state.set('ready');
          },
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
}
