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
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {TilesModule} from 'carbon-components-angular';
import {WidgetColor, WidgetColorTile} from '../../../../../models';
import {WidgetWizardService} from '../../../../../services';
import {WIDGET_COLOR_ILLUSTRATION_MAP, WIDGET_COLOR_ITEMS} from '../../../../../constants';

@Component({
  templateUrl: './widget-wizard-appearance-step.component.html',
  styleUrls: ['./widget-wizard-appearance-step.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, TranslateModule, TilesModule],
})
export class WidgetWizardAppearanceStepComponent {
  public readonly $widgetColor = this.widgetWizardService.$widgetColor;

  public readonly colorTiles: WidgetColorTile[] = WIDGET_COLOR_ITEMS.map(color => ({
    color,
    labelKey: `widgetTabManagement.appearance.backgroundColor.colors.${color.toLowerCase()}`,
    illustration: WIDGET_COLOR_ILLUSTRATION_MAP[color],
  }));

  constructor(private readonly widgetWizardService: WidgetWizardService) {}

  public onColorSelected(event: {value: WidgetColor}): void {
    if (!event?.value) return;
    this.widgetWizardService.$widgetColor.set(event.value);
  }
}
