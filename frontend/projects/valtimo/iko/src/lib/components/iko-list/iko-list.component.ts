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
import {Component, OnDestroy} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {BreadcrumbService, CarbonListModule, ColumnConfig} from '@valtimo/components';
import {BehaviorSubject, combineLatest, map, Observable, switchMap, tap} from 'rxjs';
import {IkoApiService} from '../../services';

@Component({
  selector: 'valtimo-iko-list',
  standalone: true,
  templateUrl: './iko-list.component.html',
  imports: [CommonModule, CarbonListModule],
})
export class IkoListComponent implements OnDestroy {
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly listConfig$: Observable<{fields: ColumnConfig[]; items: any[]}> = combineLatest([
    this.route.params,
    this.route.queryParams,
    this.ikoApiService.cachedMenuItems$,
  ]).pipe(
    tap(() => this.loading$.next(true)),
    switchMap(([params, queryParams, menuItems]) => {
      const currentMenuItem = menuItems.find(item => item.key === params.key);

      this.breadcrumbService.setSecondBreadcrumb({
        route: [`/iko/${params.key}`],
        content: currentMenuItem?.title ?? '',
        href: `/iko/${params.key}`,
      });

      return this.ikoApiService.searchIkoDataRequest(params.key, params.searchKey, {
        filters: queryParams,
      });
    }),
    map(res => ({
      fields: res.headers.reduce(
        (acc, curr) => [
          ...acc,
          ...(curr.displayType.type === 'hidden'
            ? []
            : [
                {
                  key: curr.key,
                  label: curr.title,
                  viewType: curr.displayType.type,
                  sortable: curr.sortable,
                  ...(!!curr.defaultSort && {default: curr.defaultSort}),
                  ...curr.displayType.displayTypeParameters,
                },
              ]),
        ],
        [] as ColumnConfig[]
      ),
      items: res.rows.content.map(stuff =>
        stuff.items.reduce((acc, curr) => ({...acc, [curr.key]: curr.value}), {})
      ),
    })),
    tap(() => this.loading$.next(false))
  );

  constructor(
    private readonly breadcrumbService: BreadcrumbService,
    private readonly ikoApiService: IkoApiService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  public ngOnDestroy(): void {
    this.breadcrumbService.clearSecondBreadcrumb();
  }

  public onRowClicked(item: any): void {
    this.router.navigate([`details/${item.id}`], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
    });
  }
}
