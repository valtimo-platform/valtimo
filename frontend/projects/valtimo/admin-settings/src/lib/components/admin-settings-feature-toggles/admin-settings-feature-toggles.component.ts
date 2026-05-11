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
import {TranslatePipe} from '@ngx-translate/core';
import {ToggleModule} from 'carbon-components-angular';
import {AdminSettingsService} from '@valtimo/components';
import {ConfigService, ValtimoConfigFeatureToggles} from '@valtimo/shared';
import {AdminSettingsManagementApiService} from '../../services';
import {FEATURE_TOGGLE_DEFINITIONS} from '../../constants';
import {FeatureToggleDefinition} from '../../models';

@Component({
  standalone: true,
  selector: 'valtimo-admin-settings-feature-toggles',
  templateUrl: './admin-settings-feature-toggles.component.html',
  styleUrls: ['./admin-settings-feature-toggles.component.scss'],
  imports: [
    CommonModule,
    TranslatePipe,
    ToggleModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettingsFeatureTogglesComponent {
  public readonly TOGGLE_DEFINITIONS = FEATURE_TOGGLE_DEFINITIONS;

  public readonly featureToggles$ = this._configService.featureToggles$;

  constructor(
    private readonly _adminSettingsManagementApiService: AdminSettingsManagementApiService,
    private readonly _adminSettingsService: AdminSettingsService,
    private readonly _configService: ConfigService
  ) {}

  public getEffectiveValue(
    definition: FeatureToggleDefinition,
    toggles: ValtimoConfigFeatureToggles
  ): boolean {
    return !!(toggles as Record<string, boolean | undefined>)[definition.key];
  }

  public onToggleChange(definition: FeatureToggleDefinition, newValue: boolean): void {
    this._adminSettingsManagementApiService
      .updateFeatureToggle({key: definition.key, enabled: newValue})
      .subscribe(() => {
        this._adminSettingsService.refreshFeatureToggles();
      });
  }
}
