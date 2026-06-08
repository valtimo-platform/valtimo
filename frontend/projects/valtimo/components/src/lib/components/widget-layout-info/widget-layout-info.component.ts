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

import {ChangeDetectionStrategy, Component} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {NotificationModule} from 'carbon-components-angular';

/**
 * Informational Carbon notification explaining the widget layout algorithms.
 * Rendered next to every layout-algorithm selector (case widget tab, IKO tab
 * and dashboard) so the trade-offs are explained consistently.
 */
@Component({
  selector: 'valtimo-widget-layout-info',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, NotificationModule],
  template: `
    <cds-inline-notification
      [notificationObj]="{
        type: 'info',
        title: 'widgetLayout.infoTitle' | translate,
        message: 'widgetLayout.info' | translate,
        showClose: false,
        lowContrast: true
      }"
    ></cds-inline-notification>
  `,
})
export class WidgetLayoutInfoComponent {}
