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
import {Component, EventEmitter, Input, OnDestroy, Output} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {BreadcrumbService, CarbonListModule, ColumnConfig} from '@valtimo/components';
import {
  BehaviorSubject,
  combineLatest,
  map,
  Observable,
  of,
  ReplaySubject,
  switchMap,
  tap,
} from 'rxjs';
import {IkoSearchParams} from '../../models';
import {IkoApiService} from '../../services';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
  selector: 'valtimo-iko-list',
  standalone: true,
  templateUrl: './iko-list.component.html',
  imports: [CommonModule, CarbonListModule, TranslatePipe],
})
export class IkoListComponent implements OnDestroy {
  @Input() public ikoViewKey: string;
  @Input() public set searchParams(params: IkoSearchParams | null) {
    if (params) this._searchParams$.next(params);
  }

  @Output() public rowSelectedEvent = new EventEmitter<{id: string; label: string}>();

  public readonly loading$ = new BehaviorSubject<boolean>(true);

  private readonly _searchParams$ = new ReplaySubject<IkoSearchParams>(1);

  public readonly listConfig$: Observable<{fields: ColumnConfig[]; items: any[]}> =
    this._searchParams$.pipe(
      switchMap(inputParams => {
        if (inputParams && this.ikoViewKey) {
          return of({
            ikoViewKey: this.ikoViewKey,
            searchKey: inputParams.paramKey,
            filters: inputParams.filters,
          });
        }

        return combineLatest([
          this.route.params,
          this.route.queryParams,
          this.ikoApiService.cachedMenuItems$,
        ]).pipe(
          map(([params, queryParams, menuItems]) => {
            const currentMenuItem = menuItems.find(item => item.key === params.key);

            this.breadcrumbService.setSecondBreadcrumb({
              route: [`/iko/${params.key}`],
              content: currentMenuItem?.title ?? '',
              href: `/iko/${params.key}`,
            });

            return {ikoViewKey: params.key, searchKey: params.searchKey, filters: queryParams};
          })
        );
      }),
      tap(() => this.loading$.next(true)),
      switchMap(({ikoViewKey, searchKey, filters}) =>
        this.ikoApiService.searchIkoSearchAction(ikoViewKey, searchKey, {filters})
      ),
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
  ) {
    combineLatest([this.route.params, this.route.queryParams])
      .pipe(takeUntilDestroyed())
      .subscribe(([params, queryParams]) => {
        if (!this.ikoViewKey && params?.key && params?.searchKey) {
          this._searchParams$.next({paramKey: params.searchKey, filters: queryParams});
        }
      });
  }

  public ngOnDestroy(): void {
    this.breadcrumbService.clearSecondBreadcrumb();
  }

  public onRowClicked(item: any): void {
    if (this.rowSelectedEvent.observed) {
      const keys = Object.keys(item).filter(k => k !== 'id');
      this.rowSelectedEvent.emit({id: item.id, label: keys.length > 0 ? item[keys[0]] : item.id});
    } else {
      this.router.navigate([`details/${item.id}`], {
        relativeTo: this.route,
        queryParamsHandling: 'preserve',
      });
    }
  }
}
