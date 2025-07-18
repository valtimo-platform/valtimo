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
import {CommonModule} from '@angular/common';
import {Component} from '@angular/core';
import {CarbonListModule, ColumnConfig} from '@valtimo/components';
import {IkoApiService} from '../../services';
import {BehaviorSubject, tap} from 'rxjs';
import {IkoDataAggregate} from '../../models';
import {Router} from '@angular/router';
import {IKO_MANAGEMENT_TABS} from '../../constants';

@Component({
  selector: 'valtimo-iko-management',
  standalone: true,
  templateUrl: './iko-management.component.html',
  imports: [CommonModule, CarbonListModule],
})
export class IkoManagementComponent {
  public readonly loading$ = new BehaviorSubject<boolean>(true);

  public readonly cachedMenuItems$ = this.ikoApiService.cachedMenuItems$.pipe(
    tap(() => this.loading$.next(false))
  );

  public readonly FIELDS: ColumnConfig[] = [
    {
      key: 'title',
      label: 'ikoManagement.title',
    },
  ];

  constructor(
    private readonly ikoApiService: IkoApiService,
    private readonly router: Router
  ) {}

  public onRowClicked(event: IkoDataAggregate): void {
    this.router.navigate(['iko-management', event.key, IKO_MANAGEMENT_TABS[0].key]);
  }
}
