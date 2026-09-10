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
import {AssistantAvailabilityService, AssistantChatService} from '../../services';
import {resolveAssistantPageContext} from '../../utils';
import {AssistantConfirmationModalComponent} from '../assistant-confirmation-modal/assistant-confirmation-modal.component';
import {AssistantPanelComponent} from '../assistant-panel/assistant-panel.component';
import {AssistantTeaserComponent} from '../assistant-teaser/assistant-teaser.component';

@Component({
  standalone: true,
  selector: 'valtimo-assistant-launcher',
  templateUrl: './assistant-launcher.component.html',
  styleUrls: ['./assistant-launcher.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AssistantConfirmationModalComponent,
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

  // Confirming a change reloads the page, so the panel has to come back open or the
  // result notice would be hidden behind the launcher.
  private readonly _OPEN_STORAGE_KEY = 'valtimoAssistantPanelOpen';
  private readonly _subscriptions = new Subscription();

  constructor(
    public readonly chatService: AssistantChatService,
    private readonly availabilityService: AssistantAvailabilityService,
    private readonly iconService: IconService,
    private readonly router: Router
  ) {
    this.iconService.registerAll([AiLaunch24]);
  }

  public ngOnInit(): void {
    this.setTeaserMessageKey(this.router.url);
    this.openRouterSubscription();
    this.restoreOpenState();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onLauncherClick(): void {
    this.setOpen(true);
    this.$teaserDismissed.set(true);
  }

  public onPanelMinimize(): void {
    this.setOpen(false);
  }

  public onTeaserClose(): void {
    this.$teaserDismissed.set(true);
  }

  private setOpen(open: boolean): void {
    this.$open.set(open);

    try {
      sessionStorage.setItem(this._OPEN_STORAGE_KEY, String(open));
    } catch {
      // Blocked storage only costs the panel its open state across a reload.
    }
  }

  private restoreOpenState(): void {
    try {
      if (sessionStorage.getItem(this._OPEN_STORAGE_KEY) === 'true') this.$open.set(true);
    } catch {
      // Nothing to restore.
    }
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
