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
import {ActivatedRoute} from '@angular/router';
import {BreadcrumbService, PageTitleService} from '@valtimo/components';
import {ConfigService} from '@valtimo/shared';
import {catchError, map, of, Subject, Subscription, switchMap, take, tap} from 'rxjs';
import {EXCHANGE_CATALOG_STATE_KEY} from '../../constants';
import {ExchangePublicationDetail, ExchangeRequestError} from '../../models';
import {ExchangeCatalogApiService} from '../../services/exchange-catalog-api.service';
import {toPublicationDetail} from '../../utils';

type ExchangeDetailState = 'loading' | 'ready' | 'notAvailable' | 'error' | 'notConfigured';

@Injectable()
export class ExchangeDetailService implements OnDestroy {
  public readonly $state = signal<ExchangeDetailState>('loading');
  public readonly $detail = signal<ExchangePublicationDetail | null>(null);

  private readonly _load$ = new Subject<void>();
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly apiService: ExchangeCatalogApiService,
    private readonly configService: ConfigService,
    private readonly pageTitleService: PageTitleService,
    private readonly breadcrumbService: BreadcrumbService
  ) {}

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this.breadcrumbService.clearSecondBreadcrumb();
  }

  public init(): void {
    this.applyBreadcrumb();

    this._subscriptions.add(
      this._load$
        .pipe(
          tap(() => this.$state.set('loading')),
          switchMap(() =>
            this.apiService.getPublication(this.publicationId()).pipe(
              map(dto => ({detail: toPublicationDetail(dto), error: null as unknown})),
              catchError((error: unknown) => of({detail: null, error}))
            )
          )
        )
        .subscribe(({detail, error}) => (detail ? this.onLoaded(detail) : this.onFailed(error)))
    );

    this._subscriptions.add(
      this.configService.exchangeConfiguration$.pipe(take(1)).subscribe(configuration => {
        if (!configuration?.enabled || !configuration.url) {
          this.$state.set('notConfigured');
          return;
        }

        this._load$.next();
      })
    );
  }

  public retry(): void {
    this._load$.next();
  }

  private publicationId(): string {
    return this.route.snapshot.paramMap.get('publicationId') ?? '';
  }

  private onLoaded(detail: ExchangePublicationDetail): void {
    // Exchange serves non-published publications by id; never show them
    if (!detail.isPublished) {
      this.$state.set('notAvailable');
      return;
    }

    this.$detail.set(detail);
    this.pageTitleService.setCustomPageTitle(detail.name);
    this.$state.set('ready');
  }

  private onFailed(error: unknown): void {
    this.$state.set(
      error instanceof ExchangeRequestError && error.kind === 'notFound' ? 'notAvailable' : 'error'
    );
  }

  private applyBreadcrumb(): void {
    const queryParams = history.state?.[EXCHANGE_CATALOG_STATE_KEY] ?? {};

    this.breadcrumbService.setSecondBreadcrumb({
      content: 'exchange.title',
      route: ['/exchange'],
      href: '/exchange',
      routeExtras: {queryParams},
    });
  }
}

export {ExchangeDetailState};
