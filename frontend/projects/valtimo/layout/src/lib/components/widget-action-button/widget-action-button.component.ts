/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import {Component, Input} from '@angular/core';
import {ButtonModule} from 'carbon-components-angular';
import {BasicWidget, WidgetAction} from '../../models';
import {GlobalNotificationService} from '@valtimo/shared';

@Component({
  selector: 'valtimo-widget-action-button',
  templateUrl: './widget-action-button.component.html',
  styleUrl: './widget-action-button.component.scss',
  standalone: true,
  imports: [CommonModule, ButtonModule],
})
export class WidgetActionButtonComponent {
  @Input() public widgetConfiguration: BasicWidget;
  @Input() public resolvedData: object;

  constructor(private readonly globalNotificationService: GlobalNotificationService) {}

  public onNavigateButtonClick(buttonAction: WidgetAction): void {
    const navigateTo = this.resolveProperty(buttonAction?.navigateTo, this.resolvedData);
    if (navigateTo?.startsWith(window.location.origin) || navigateTo?.startsWith('/')) {
      window.open(navigateTo, '_self');
    } else if (navigateTo?.startsWith('http')) {
      window.open(navigateTo, '_blank');
    } else {
      this.globalNotificationService.showToast({
        title: 'An unexpected error occurred',
        caption: `Unable to navigate to ${navigateTo}`,
        type: 'error',
      });
    }
  }

  private resolveProperty(property: string, data: {[key: string]: any}): string {
    const resolved = data?.resolved || data;
    return property ? (resolved ? String(resolved[property]) : property) : null;
  }
}
