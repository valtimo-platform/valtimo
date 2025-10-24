/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import {Component, OnDestroy, OnInit, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {BuildingBlockManagementApiService} from '../../services';
import {Subscription} from 'rxjs';
import {CarbonListModule} from '@valtimo/components';
import {TranslateModule} from '@ngx-translate/core';
import {ButtonModule, IconModule} from 'carbon-components-angular';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-process-builder',
  templateUrl: './building-block-management-process-builder.component.html',
  styleUrls: ['./building-block-management-process-builder.component.scss'],
  imports: [CommonModule, CarbonListModule, TranslateModule, ButtonModule, IconModule],
})
export class BuildingBlockManagementProcessBuilderComponent implements OnInit, OnDestroy {
  public readonly $loading = signal<boolean>(true);

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService
  ) {}

  public ngOnInit(): void {}

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }
}
