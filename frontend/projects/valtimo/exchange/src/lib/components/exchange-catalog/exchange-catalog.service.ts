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

import {Injectable, OnDestroy, signal} from '@angular/core';
import {ActivatedRoute, convertToParamMap, Router} from '@angular/router';
import {VersionService} from '@valtimo/components';
import {ConfigService} from '@valtimo/shared';
import {
  catchError,
  combineLatest,
  map,
  of,
  startWith,
  Subject,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {
  ExchangeCatalogItem,
  ExchangeCatalogParams,
  ExchangePublicationType,
  ExchangeRequestError,
  ExchangeSort,
} from '../../models';
import {ExchangeCatalogApiService} from '../../services/exchange-catalog-api.service';
import {parseCatalogParams, toCatalogQueryParams, toCatalogItem} from '../../utils';

type ExchangeCatalogState = 'loading' | 'ready' | 'error' | 'notConfigured';

@Injectable()
export class ExchangeCatalogService implements OnDestroy {
  public readonly $state = signal<ExchangeCatalogState>('loading');
  public readonly $items = signal<ReadonlyArray<ExchangeCatalogItem>>([]);
  public readonly $total = signal<number>(0);
  public readonly $tags = signal<ReadonlyArray<string>>([]);
  public readonly $runningVersion = signal<string | null>(null);
  public readonly $params = signal<ExchangeCatalogParams>(
    parseCatalogParams(convertToParamMap({}))
  );

  private readonly _retry$ = new Subject<void>();
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly apiService: ExchangeCatalogApiService,
    private readonly configService: ConfigService,
    private readonly versionService: VersionService
  ) {
    this.$params.set(parseCatalogParams(route.snapshot.queryParamMap));
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public init(): void {
    this._subscriptions.add(
      this.configService.exchangeConfiguration$.pipe(take(1)).subscribe(configuration => {
        if (!configuration?.enabled || !configuration.url) {
          this.$state.set('notConfigured');
          return;
        }

        this.loadSideData();
        this.listenForSearches();
      })
    );
  }

  public retry(): void {
    this._retry$.next();
  }

  public setSearch(q: string): void {
    this.update({q, page: 1});
  }

  public setTypes(types: ReadonlyArray<ExchangePublicationType>): void {
    this.update({types, page: 1});
  }

  public setTags(tags: ReadonlyArray<string>): void {
    this.update({tags, page: 1});
  }

  public setSort(sort: ExchangeSort): void {
    this.update({sort, page: 1});
  }

  public setPage(page: number, size: number = this.$params().size): void {
    this.update({page, size});
  }

  public clearFilters(): void {
    this.update({types: [], tags: [], page: 1});
  }

  private update(changes: Partial<ExchangeCatalogParams>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toCatalogQueryParams({...this.$params(), ...changes}),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private loadSideData(): void {
    this.apiService
      .getTags()
      .pipe(catchError(() => of({tags: []})))
      .subscribe(result =>
        this.$tags.set([...(result.tags ?? [])].sort((a, b) => a.localeCompare(b)))
      );

    this.versionService
      .getVersion()
      .pipe(catchError(() => of(null)))
      .subscribe(version => this.$runningVersion.set(version?.version || null));
  }

  private listenForSearches(): void {
    this._subscriptions.add(
      combineLatest([
        this.route.queryParamMap.pipe(map(parseCatalogParams)),
        this._retry$.pipe(startWith(undefined)),
      ])
        .pipe(
          tap(([params]) => {
            this.$params.set(params);
            this.$state.set('loading');
          }),
          switchMap(([params]) =>
            this.apiService
              .search({
                name: params.q,
                types: params.types,
                tags: params.tags,
                sort: params.sort,
                page: params.page - 1,
                size: params.size,
              })
              .pipe(
                map(result => ({result, error: null as ExchangeRequestError | null})),
                catchError((error: ExchangeRequestError) => of({result: null, error}))
              )
          )
        )
        .subscribe(({result, error}) => {
          if (error || !result) {
            this.$state.set(error?.kind === 'notConfigured' ? 'notConfigured' : 'error');
            return;
          }

          this.$items.set((result.content ?? []).map(toCatalogItem));
          this.$total.set(result.totalElements ?? 0);
          this.$state.set('ready');
        })
    );
  }
}

export {ExchangeCatalogState};
