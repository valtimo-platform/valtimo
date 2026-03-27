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
import {ChangeDetectionStrategy, Component, HostBinding, Input, ViewEncapsulation} from '@angular/core';
import {ProgressIndicatorModule, Step} from 'carbon-components-angular';
import {ProgressWidget} from '../../models';

@Component({
  selector: 'valtimo-widget-progress',
  templateUrl: './widget-progress.component.html',
  styleUrl: './widget-progress.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [CommonModule, ProgressIndicatorModule],
})
export class WidgetProgressComponent {
  @HostBinding('class') public readonly hostClass = 'valtimo-widget-progress';

  @Input() public steps: Step[] = [];
  @Input() public current = 0;
  @Input() public widgetConfiguration: ProgressWidget | null = null;

  public get orientation(): 'horizontal' | 'vertical' {
    return this.widgetConfiguration?.properties?.orientation ?? 'horizontal';
  }
}
