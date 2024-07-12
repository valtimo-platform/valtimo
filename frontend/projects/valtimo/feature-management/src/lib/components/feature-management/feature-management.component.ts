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

import {ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {
  ConfigService,
  ValtimoConfigFeatureToggleNames,
  ValtimoConfigFeatureToggles,
} from '@valtimo/config';
import {BehaviorSubject, Observable, of, Subscription} from 'rxjs';
import {
  DropdownModule,
  InputModule,
  StructuredListModule,
  ToggleModule,
} from 'carbon-components-angular';
import {FormsModule} from '@angular/forms';

@Component({
  templateUrl: './feature-management.component.html',
  styleUrls: ['./feature-management.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    DropdownModule,
    StructuredListModule,
    ToggleModule,
    FormsModule,
    InputModule,
  ],
})
export class FeatureManagementComponent implements OnInit, OnDestroy {
  public readonly configurableFeatureToggles: Array<keyof ValtimoConfigFeatureToggles> = [
    'showPlantATreeButton',
    'allowUserThemeSwitching',
    'enableCompactModeToggle',
    'hideValtimoVersionsForNonAdmins',
  ];
  public readonly featureToggles$ = Object.fromEntries(
    Object.keys(ValtimoConfigFeatureToggleNames).map(key => [
      key,
      new BehaviorSubject<boolean>(
        this.configService.getFeatureToggle(key as keyof ValtimoConfigFeatureToggles)
      ),
    ])
  );
  private _subscriptions = new Subscription();

  constructor(private readonly configService: ConfigService) {}

  public ngOnInit(): void {
    this.getFeatureToggles();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public setFeatureToggle(key: keyof ValtimoConfigFeatureToggles, enabled: boolean): void {
    this.configService.setFeatureToggle(key, enabled);
    this.featureToggles$[key].next(enabled);
  }

  private getFeatureToggles(): void {
    this._subscriptions.add(
      this.configService.featureToggles$.subscribe(featureToggles =>
        Object.entries(featureToggles).map(([key, value]) => this.featureToggles$[key]?.next(value))
      )
    );
  }
}
