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
import {Injectable} from '@angular/core';
import {Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {GlobalNotificationService} from '@valtimo/shared';

import {WidgetAction, WidgetActionData} from '../models';

@Injectable({
  providedIn: 'root',
})
export class WidgetActionService {
  constructor(
    private readonly globalNotificationService: GlobalNotificationService,
    private readonly router: Router,
    private readonly translateService: TranslateService
  ) {}

  /**
   * Executes a configured widget action, such as the row click action of an interactive table.
   *
   * The `navigateTo` of an action is either a literal url, or a key in the `resolved` map of the
   * widget data (or of the clicked row) it is handled with.
   */
  public handleAction(
    action: WidgetAction | null | undefined,
    data: WidgetActionData | null = null
  ): void {
    if (!action) return;

    const navigateTo = this.resolveProperty(action.navigateTo, data);

    if (!navigateTo) {
      this.showUnsupportedActionToast(action);
      return;
    }

    this.navigateTo(navigateTo, !!action.openInNewTab);
  }

  private navigateTo(navigateTo: string, openInNewTab: boolean): void {
    if (openInNewTab) {
      window.open(navigateTo, '_blank', 'noopener,noreferrer');
    } else if (navigateTo.startsWith(window.location.origin)) {
      this.router.navigateByUrl(navigateTo.substring(window.location.origin.length));
    } else if (navigateTo.startsWith('/')) {
      this.router.navigateByUrl(navigateTo);
    } else if (navigateTo.startsWith('http')) {
      window.open(navigateTo, '_blank', 'noopener,noreferrer');
    } else {
      this.showErrorToast(
        this.translateService.instant('widgets.action.navigationError', {navigateTo})
      );
    }
  }

  private resolveProperty(
    property: string | undefined,
    data: WidgetActionData | null
  ): string | null {
    if (!property) return null;

    const resolved = data?.resolved ?? data;
    const value = resolved?.[property];

    return value === null || value === undefined ? property : String(value);
  }

  private showUnsupportedActionToast(action: WidgetAction): void {
    const unsupportedAction = action.processDefinitionKey ?? action.caseDefinitionKey;

    if (!unsupportedAction) return;

    this.showErrorToast(
      this.translateService.instant('widgets.action.unsupported', {action: unsupportedAction})
    );
  }

  private showErrorToast(caption: string): void {
    this.globalNotificationService.showToast({
      title: this.translateService.instant('widgets.action.errorTitle'),
      caption,
      type: 'error',
    });
  }
}
