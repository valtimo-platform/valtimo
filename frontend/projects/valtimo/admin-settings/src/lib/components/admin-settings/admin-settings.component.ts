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
import {ActivatedRoute, Router} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import {TabsModule} from 'carbon-components-angular';
import {map} from 'rxjs';
import {ADMIN_SETTINGS_TABS} from '../../constants';
import {AdminSettingsAppearanceComponent} from '../admin-settings-appearance/admin-settings-appearance.component';
import {AdminSettingsFeatureTogglesComponent} from '../admin-settings-feature-toggles/admin-settings-feature-toggles.component';
import {AdminSettingsMenuConfigurationComponent} from '../admin-settings-menu-configuration/admin-settings-menu-configuration.component';

@Component({
  standalone: true,
  selector: 'valtimo-admin-settings',
  templateUrl: './admin-settings.component.html',
  styleUrls: ['./admin-settings.component.scss'],
  imports: [
    CommonModule,
    TranslatePipe,
    TabsModule,
    AdminSettingsAppearanceComponent,
    AdminSettingsFeatureTogglesComponent,
    AdminSettingsMenuConfigurationComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettingsComponent {
  public readonly ADMIN_SETTINGS_TABS = ADMIN_SETTINGS_TABS;

  public readonly activeTabKey$ = this._route.params.pipe(
    map(params => params['tabKey'] || ADMIN_SETTINGS_TABS.APPEARANCE)
  );

  constructor(
    private readonly _route: ActivatedRoute,
    private readonly _router: Router
  ) {}

  public switchTab(tabKey: string): void {
    this._router.navigate(['..', tabKey], {relativeTo: this._route});
  }
}
