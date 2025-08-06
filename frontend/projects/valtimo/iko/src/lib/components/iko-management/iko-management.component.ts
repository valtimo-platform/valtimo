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
import {Component, OnDestroy, OnInit} from '@angular/core';
import {CarbonListModule, ColumnConfig, PageTitleService} from '@valtimo/components';
import {IkoApiService, IkoManagementApiService} from '../../services';
import {BehaviorSubject, filter, switchMap, take, tap} from 'rxjs';
import {IkoDataAggregate} from '../../models';
import {ActivatedRoute, Router} from '@angular/router';
import {IKO_MANAGEMENT_TABS} from '../../constants';
import {map} from 'rxjs/operators';

@Component({
  selector: 'valtimo-iko-management',
  standalone: true,
  templateUrl: './iko-management.component.html',
  imports: [CommonModule, CarbonListModule],
})
export class IkoManagementComponent implements OnInit, OnDestroy {
  public readonly loading$ = new BehaviorSubject<boolean>(true);

  private readonly _apiKey$ = this.route.params.pipe(
    map(params => params?.apiKey as string),
    filter(key => !!key)
  );

  public readonly ikoDataAggregates$ = this._apiKey$.pipe(
    switchMap(apiKey =>
      this.ikoManagementApiService
        .getManagementIkoDataAggregates(undefined, undefined, apiKey)
        .pipe(
          map(dataAggregatePage => dataAggregatePage.content),
          tap(() => this.loading$.next(false))
        )
    )
  );

  public readonly FIELDS: ColumnConfig[] = [
    {
      key: 'title',
      label: 'ikoManagement.title',
    },
  ];

  constructor(
    private readonly ikoApiService: IkoApiService,
    private readonly ikoManagementApiService: IkoManagementApiService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly pageTitleService: PageTitleService
  ) {}

  public ngOnInit(): void {
    this.pageTitleService.disableReset();
    this.setPageTitle();
  }

  public ngOnDestroy(): void {
    this.pageTitleService.enableReset();
  }

  public onRowClicked(event: IkoDataAggregate): void {
    this._apiKey$.pipe(take(1)).subscribe(apiKey => {
      this.router.navigate(['iko-management', apiKey, event.key, IKO_MANAGEMENT_TABS[0].key]);
    });
  }

  private setPageTitle(): void {
    this._apiKey$
      .pipe(
        take(1),
        switchMap(apiKey => this.ikoManagementApiService.getIkoRepositoryConfig(apiKey))
      )
      .subscribe(repositoryConfig => {
        this.pageTitleService.setCustomPageTitle(repositoryConfig.title);
      });
  }
}
