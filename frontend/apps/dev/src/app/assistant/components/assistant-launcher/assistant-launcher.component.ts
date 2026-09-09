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
import {NavigationEnd, Router} from '@angular/router';
import {AiLaunch24} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {IconModule, IconService} from 'carbon-components-angular';
import {Observable, Subscription} from 'rxjs';
import {filter} from 'rxjs/operators';
import {ASSISTANT_TEST_IDS} from '../../constants';
import {AssistantAvailabilityService} from '../../services';
import {resolveAssistantPageContext} from '../../utils';
import {AssistantPanelComponent} from '../assistant-panel/assistant-panel.component';
import {AssistantTeaserComponent} from '../assistant-teaser/assistant-teaser.component';

@Component({
  standalone: true,
  selector: 'valtimo-assistant-launcher',
  templateUrl: './assistant-launcher.component.html',
  styleUrls: ['./assistant-launcher.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AssistantPanelComponent,
    AssistantTeaserComponent,
    CommonModule,
    IconModule,
    TranslateModule,
  ],
})
export class AssistantLauncherComponent implements OnInit, OnDestroy {
  public readonly $open = signal<boolean>(false);
  public readonly $teaserDismissed = signal<boolean>(false);
  public readonly $teaserMessageKey = signal<string | null>(null);

  public readonly assistantAvailable$: Observable<boolean> = this.availabilityService.available$;

  protected readonly testIds = ASSISTANT_TEST_IDS;

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly availabilityService: AssistantAvailabilityService,
    private readonly iconService: IconService,
    private readonly router: Router
  ) {
    this.iconService.registerAll([AiLaunch24]);
  }

  public ngOnInit(): void {
    this.setTeaserMessageKey(this.router.url);
    this.openRouterSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onLauncherClick(): void {
    this.$open.set(true);
    this.$teaserDismissed.set(true);
  }

  public onPanelMinimize(): void {
    this.$open.set(false);
  }

  public onTeaserClose(): void {
    this.$teaserDismissed.set(true);
  }

  private openRouterSubscription(): void {
    this._subscriptions.add(
      this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe(event => {
          this.$teaserDismissed.set(false);
          this.setTeaserMessageKey(event.urlAfterRedirects);
        })
    );
  }

  private setTeaserMessageKey(url: string): void {
    const resolved = resolveAssistantPageContext(url);

    this.$teaserMessageKey.set(resolved?.definition.teaserMessageKey ?? null);
  }
}
