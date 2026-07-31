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
import {ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit, signal} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {ExternalPluginWidget, WidgetLayoutService} from '@valtimo/layout';
import {
  derivePluginDataUrl,
  ExternalPluginIframeComponent,
  ExternalPluginSessionService,
} from '@valtimo/plugin';
import {LoadingModule} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  Subscription,
  switchMap,
  throwError,
} from 'rxjs';
import {CaseTabService, CaseWidgetsApiService} from '../../../../../../services';
import {ExternalPluginWidgetContent, ExternalPluginWidgetState} from '../../../../../../models';

@Component({
  selector: 'valtimo-case-widget-external-plugin',
  templateUrl: './case-widget-external-plugin.component.html',
  styleUrls: ['./case-widget-external-plugin.component.scss'],
  standalone: true,
  providers: [ExternalPluginSessionService],
  imports: [CommonModule, LoadingModule, TranslateModule, ExternalPluginIframeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseWidgetExternalPluginComponent implements OnInit, OnDestroy {
  @Input({required: true}) public set documentId(value: string) {
    this._documentId$.next(value);
  }

  @Input() public set widgetConfiguration(value: ExternalPluginWidget) {
    if (!value) return;
    this._widgetConfiguration$.next(value);
  }

  @Input() public readonly widgetUuid: string;

  public readonly $state = signal<ExternalPluginWidgetState>('loading');
  public readonly $content = signal<ExternalPluginWidgetContent | null>(null);
  public readonly $pluginDataUrl = signal<string | null>(null);
  public readonly $iframeReady = signal<boolean>(false);

  private readonly _documentId$ = new BehaviorSubject<string | null>(null);
  private readonly _widgetConfiguration$ = new BehaviorSubject<ExternalPluginWidget | null>(null);
  private readonly _tabKey$: Observable<string> = this.caseTabService.activeTabKey$;

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly caseTabService: CaseTabService,
    private readonly caseWidgetsApiService: CaseWidgetsApiService,
    private readonly widgetLayoutService: WidgetLayoutService,
    protected readonly sessionService: ExternalPluginSessionService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      combineLatest([
        this._documentId$.pipe(filter((documentId): documentId is string => !!documentId)),
        this._widgetConfiguration$.pipe(
          filter((widget): widget is ExternalPluginWidget => !!widget)
        ),
        this._tabKey$,
      ])
        .pipe(
          switchMap(([documentId, widget, tabKey]) =>
            (
              this.caseWidgetsApiService.getWidgetData(
                documentId,
                tabKey,
                widget.key
              ) as unknown as Observable<ExternalPluginWidgetContent>
            ).pipe(
              switchMap(content =>
                content?.bundleUrl && content.configurationId
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
          error: error =>
            this.$state.set(error?.message === 'bundle-unavailable' ? 'unavailable' : 'error'),
        })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onIframeReady(): void {
    this.$iframeReady.set(true);
    if (this.widgetUuid) this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid);
  }

  private onLoaded(content: ExternalPluginWidgetContent): void {
    this.$content.set(content);
    this.$pluginDataUrl.set(derivePluginDataUrl(content.bundleUrl));
    this.$state.set('ready');
  }
}
