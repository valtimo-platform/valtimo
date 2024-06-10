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
import {ChangeDetectionStrategy, Component, EventEmitter, Output} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {TilesModule} from 'carbon-components-angular';
import {WidgetWizardService} from '../../../../services';
import {WidgetStyle} from '../../../../models';

@Component({
  selector: 'valtimo-widget-wizard-style-step',
  templateUrl: './widget-wizard-style-step.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, TranslateModule, TilesModule],
})
export class WidgetWizardStyleStepComponent {
  public readonly WidgetStyle = WidgetStyle;
  public readonly widgetStyle = this.widgetWizardService.widgetStyle;

  constructor(private readonly widgetWizardService: WidgetWizardService) {}

  public onSelectedEvent(event: {value: WidgetStyle}): void {
    this.widgetWizardService.widgetStyle.set(event.value);
  }
}
