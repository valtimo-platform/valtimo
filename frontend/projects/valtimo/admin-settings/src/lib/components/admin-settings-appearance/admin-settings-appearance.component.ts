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
import {CommonModule} from '@angular/common';
import {MuuriDirectiveModule} from '@valtimo/components';
import {AdminSettingsLogoComponent} from '../admin-settings-logo/admin-settings-logo.component';
import {AdminSettingsColorComponent} from '../admin-settings-color/admin-settings-color.component';

@Component({
  standalone: true,
  selector: 'valtimo-admin-settings-appearance',
  templateUrl: './admin-settings-appearance.component.html',
  imports: [CommonModule, MuuriDirectiveModule, AdminSettingsLogoComponent, AdminSettingsColorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettingsAppearanceComponent {}
