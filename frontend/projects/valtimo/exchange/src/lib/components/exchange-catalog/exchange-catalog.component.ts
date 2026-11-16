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

import {ChangeDetectionStrategy, Component, computed, OnDestroy, OnInit} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {RouterLink} from '@angular/router';
import {ArrowRight16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {CarbonListModule} from '@valtimo/components';
import {
  ButtonModule,
  CheckboxModule,
  DropdownModule,
  IconModule,
  IconService,
  ListItem,
  PaginationModel,
  PaginationModule,
  SearchModule,
  SkeletonModule,
  TagModule,
  TilesModule,
} from 'carbon-components-angular';
import {debounceTime, distinctUntilChanged, Subject, Subscription} from 'rxjs';
import {EXCHANGE_CATALOG_STATE_KEY, EXCHANGE_CATALOG_TEST_IDS} from '../../constants';
import {ExchangePublicationType, ExchangeSort} from '../../models';
import {ExchangeCatalogApiService} from '../../services/exchange-catalog-api.service';
import {compareValtimoVersions, PUBLICATION_TYPES, toCatalogQueryParams} from '../../utils';
import {ExchangeArtifactVisualComponent} from '../exchange-artifact-visual/exchange-artifact-visual.component';
import {ExchangeCatalogService} from './exchange-catalog.service';

const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_TILES = [1, 2, 3, 4, 5, 6];
const SORT_VALUES: Array<ExchangeSort> = ['nameAsc', 'recent'];

@Component({
  standalone: true,
  templateUrl: './exchange-catalog.component.html',
  styleUrls: ['./exchange-catalog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExchangeCatalogApiService, ExchangeCatalogService],
  imports: [
    ButtonModule,
    CheckboxModule,
    DropdownModule,
    ExchangeArtifactVisualComponent,
    IconModule,
    CarbonListModule,
    PaginationModule,
    RouterLink,
    SearchModule,
    SkeletonModule,
    TagModule,
    TilesModule,
    TranslateModule,
  ],
})
export class ExchangeCatalogComponent implements OnInit, OnDestroy {
  protected readonly testIds = EXCHANGE_CATALOG_TEST_IDS;
  protected readonly types = PUBLICATION_TYPES;
  protected readonly skeletonTiles = SKELETON_TILES;

  protected readonly $filtersActive = computed(
    () => this.service.$params().types.length > 0 || this.service.$params().tags.length > 0
  );

  protected readonly $pageCount = computed(() =>
    Math.ceil(this.service.$total() / this.service.$params().size)
  );

  protected readonly $paginationModel = computed(() => {
    const model = new PaginationModel();
    model.currentPage = this.service.$params().page;
    model.totalDataLength = this.$pageCount();
    return model;
  });

  private readonly $sortLabels = toSignal(
    this.translateService.stream(SORT_VALUES.map(value => `exchange.catalog.sort.${value}`)),
    {initialValue: {} as Record<string, string>}
  );

  protected readonly $sortItems = computed<Array<ListItem>>(() =>
    SORT_VALUES.map(value => ({
      content: this.$sortLabels()[`exchange.catalog.sort.${value}`] ?? '',
      value,
      selected: this.service.$params().sort === value,
    }))
  );

  protected readonly $newerIds = computed(
    () =>
      new Set(
        this.service
          .$items()
          .filter(
            item =>
              compareValtimoVersions(item.valtimoVersion, this.service.$runningVersion()) ===
              'NEWER'
          )
          .map(item => item.id)
      )
  );

  protected readonly $tileState = computed(() => {
    const queryParams = Object.fromEntries(
      Object.entries(toCatalogQueryParams(this.service.$params())).filter(
        ([, value]) => value !== null
      )
    );
    return {[EXCHANGE_CATALOG_STATE_KEY]: queryParams};
  });

  private readonly _search$ = new Subject<string>();
  private readonly _subscriptions = new Subscription();

  constructor(
    protected readonly service: ExchangeCatalogService,
    private readonly translateService: TranslateService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([ArrowRight16]);
  }

  public ngOnInit(): void {
    this.service.init();

    this._subscriptions.add(
      this._search$
        .pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged())
        .subscribe(q => this.service.setSearch(q))
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  protected onSearch(value: string): void {
    this._search$.next(value ?? '');
  }

  protected onSort(event: {item: ListItem}): void {
    this.service.setSort(event.item?.['value'] as ExchangeSort);
  }

  protected onTypeChange(type: ExchangePublicationType, checked: boolean): void {
    const current = this.service.$params().types;
    this.service.setTypes(checked ? [...current, type] : current.filter(t => t !== type));
  }

  protected onTagChange(tag: string, checked: boolean): void {
    const current = this.service.$params().tags;
    this.service.setTags(checked ? [...current, tag] : current.filter(t => t !== tag));
  }

  protected onPage(page: number): void {
    this.service.setPage(page);
  }
}
