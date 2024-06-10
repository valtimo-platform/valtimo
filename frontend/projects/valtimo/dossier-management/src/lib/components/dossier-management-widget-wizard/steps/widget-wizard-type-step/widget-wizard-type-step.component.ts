/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
import {ChangeDetectionStrategy, Component, ViewEncapsulation} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {AVAILABLE_WIDGETS, WidgetTypeSelection} from '../../../../models';
import {TilesModule} from 'carbon-components-angular';
import {WidgetWizardService} from '../../../../services';

@Component({
  selector: 'valtimo-widget-wizard-type-step',
  templateUrl: './widget-wizard-type-step.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [CommonModule, TranslateModule, TilesModule],
})
export class WidgetWizardTypeStepComponent {
  public readonly availableWidgets = AVAILABLE_WIDGETS;
  public readonly selectedWidget = this.widgetWizardService.selectedWidget;

  constructor(private readonly widgetWizardService: WidgetWizardService) {}

  public onSelectedEvent(event: {value: WidgetTypeSelection}): void {
    if (event.value.type !== this.widgetWizardService.selectedWidget()?.type) {
      this.widgetWizardService.widgetContent.set(null);
      this.widgetWizardService.widgetTitle.set(null);
    }

    this.widgetWizardService.selectedWidget.set(event.value);
  }
}
