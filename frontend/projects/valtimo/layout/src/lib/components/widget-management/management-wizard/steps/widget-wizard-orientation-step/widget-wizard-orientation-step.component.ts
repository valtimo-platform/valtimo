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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {TilesModule} from 'carbon-components-angular';
import {WidgetProgressContent} from '../../../../../models';
import {WidgetWizardService} from '../../../../../services';

@Component({
  templateUrl: './widget-wizard-orientation-step.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, TranslateModule, TilesModule],
})
export class WidgetWizardOrientationStepComponent {
  public readonly $widgetContent = this.widgetWizardService.$widgetContent;

  public get selectedOrientation(): 'horizontal' | 'vertical' {
    return (this.widgetWizardService.$widgetContent() as WidgetProgressContent)?.orientation ?? 'horizontal';
  }

  constructor(private readonly widgetWizardService: WidgetWizardService) {}

  public onSelectedEvent(event: {value: 'horizontal' | 'vertical'}): void {
    this.widgetWizardService.$widgetContent.set({orientation: event.value});
    // Auto-set width: horizontal = 4 columns (xtra large), vertical = 1 column (small)
    this.widgetWizardService.$widgetWidth.set(event.value === 'horizontal' ? 4 : 1);
  }
}
